const express = require('express');
const soap = require('soap');
const { Pool } = require('pg');

const app = express();
const port = 3001;

// Configuración de PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'soap_service',
    password: 'post17clave',
    port: 5432,
});

// Servicio SOAP
const service = {
    AvailabilityService: {
        AvailabilityPort: {
            checkAvailability: async (args) => {
                console.log('Request received:', args);
                const { startDate, endDate, roomType } = args;

                if (!startDate || !endDate || !roomType) {
                    throw new Error('Missing required parameters: startDate, endDate, roomType');
                }

                try {
                    // Consulta a la base de datos
                    const query = `
                        SELECT room_id, room_type, available_date, status 
                        FROM availability 
                        WHERE room_type = $1 AND available_date BETWEEN $2 AND $3
                    `;
                    const { rows } = await pool.query(query, [roomType, startDate, endDate]);

                    // Convertir los resultados a una estructura XML válida
                    const rooms = rows.map((room) => ({
                        room_id: room.room_id,
                        room_type: room.room_type,
                        available_date: room.available_date.toISOString(),
                        status: room.status,
                    }));

                    return {
                        rooms: {
                            room: rooms, // Devuelve una lista de habitaciones
                        },
                    };
                } catch (error) {
                    console.error('Database error:', error);
                    throw new Error('Internal Server Error: Database query failed');
                }
            },
        },
    },
};

// Archivo WSDL
const wsdl = `
<definitions name="AvailabilityService" targetNamespace="http://example.com/availability"
    xmlns:tns="http://example.com/availability" xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns="http://schemas.xmlsoap.org/wsdl/">

    <types>
        <xsd:schema targetNamespace="http://example.com/availability">
            <xsd:element name="checkAvailability">
                <xsd:complexType>
                    <xsd:sequence>
                        <xsd:element name="startDate" type="xsd:date"/>
                        <xsd:element name="endDate" type="xsd:date"/>
                        <xsd:element name="roomType" type="xsd:string"/>
                    </xsd:sequence>
                </xsd:complexType>
            </xsd:element>

            <xsd:element name="checkAvailabilityResponse">
                <xsd:complexType>
                    <xsd:sequence>
                        <xsd:element name="rooms">
                            <xsd:complexType>
                                <xsd:sequence>
                                    <xsd:element name="room" maxOccurs="unbounded">
                                        <xsd:complexType>
                                            <xsd:sequence>
                                                <xsd:element name="room_id" type="xsd:int"/>
                                                <xsd:element name="room_type" type="xsd:string"/>
                                                <xsd:element name="available_date" type="xsd:dateTime"/>
                                                <xsd:element name="status" type="xsd:string"/>
                                            </xsd:sequence>
                                        </xsd:complexType>
                                    </xsd:element>
                                </xsd:sequence>
                            </xsd:complexType>
                        </xsd:element>
                    </xsd:sequence>
                </xsd:complexType>
            </xsd:element>
        </xsd:schema>
    </types>

    <message name="checkAvailabilityRequest">
        <part name="parameters" element="tns:checkAvailability"/>
    </message>
    <message name="checkAvailabilityResponse">
        <part name="parameters" element="tns:checkAvailabilityResponse"/>
    </message>

    <portType name="AvailabilityPort">
        <operation name="checkAvailability">
            <input message="tns:checkAvailabilityRequest"/>
            <output message="tns:checkAvailabilityResponse"/>
        </operation>
    </portType>

    <binding name="AvailabilityBinding" type="tns:AvailabilityPort">
        <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
        <operation name="checkAvailability">
            <soap:operation soapAction="checkAvailability"/>
            <input>
                <soap:body use="literal"/>
            </input>
            <output>
                <soap:body use="literal"/>
            </output>
        </operation>
    </binding>

    <service name="AvailabilityService">
        <port name="AvailabilityPort" binding="tns:AvailabilityBinding">
            <soap:address location="http://localhost:3001/wsdl"/>
        </port>
    </service>
</definitions>`;

app.listen(port, () => {
    console.log(`SOAP Service running at http://localhost:${port}`);
    soap.listen(app, '/wsdl', service, wsdl);
});
