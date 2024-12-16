const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Pool } = require('pg');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const xml2js = require('xml2js'); // Para convertir XML a JSON

const app = express();
app.use(bodyParser.json());

// Configuración de PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'rest_api',
    password: 'post17clave',
    port: 5432,
});

// Configuración de Swagger
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Hotel Reservation API',
            version: '1.0.0',
            description: 'API para gestionar reservas de habitaciones de hotel',
            contact: { name: 'Tu Nombre' },
        },
        servers: [{ url: 'http://localhost:3002', description: 'Servidor local' }],
    },
    apis: ['./index.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Endpoint para crear reserva
/**
 * @swagger
 * /reservations:
 *   post:
 *     summary: Crear una nueva reserva
 *     description: Verifica disponibilidad llamando al servicio SOAP y crea una nueva reserva si hay habitaciones disponibles.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomType:
 *                 type: string
 *                 example: Single
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-06-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-06-03"
 *               customerName:
 *                 type: string
 *                 example: "John Doe"
 *     responses:
 *       200:
 *         description: Reserva creada exitosamente
 *       400:
 *         description: No hay habitaciones disponibles
 *       500:
 *         description: Error interno del servidor
 */
app.post('/reservations', async (req, res) => {
    const { roomType, startDate, endDate, customerName } = req.body;

    try {
        // Crear solicitud SOAP
        const soapRequest = `
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:avail="http://example.com/availability">
            <soapenv:Header/>
            <soapenv:Body>
                <avail:checkAvailability>
                    <avail:startDate>${startDate}</avail:startDate>
                    <avail:endDate>${endDate}</avail:endDate>
                    <avail:roomType>${roomType}</avail:roomType>
                </avail:checkAvailability>
            </soapenv:Body>
        </soapenv:Envelope>`;

        // Verificar disponibilidad llamando al servicio SOAP
        const response = await axios.post('http://localhost:3001/wsdl', soapRequest, {
            headers: { 'Content-Type': 'text/xml;charset=UTF-8', 'Accept': 'text/xml' },
        });

        // Imprimir respuesta SOAP para depuración
        console.log('SOAP Response:', response.data);

        // Convertir respuesta SOAP XML a JSON
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(response.data);

        // Extraer habitaciones disponibles de forma segura
        const body = result['soap:Envelope']['soap:Body'];
        if (!body || !body['tns:checkAvailabilityResponse']) {
            throw new Error('Invalid SOAP response: checkAvailabilityResponse not found');
        }

        const rooms = body['tns:checkAvailabilityResponse'].rooms?.room;

        if (!rooms) {
            return res.status(400).json({ message: 'No rooms available' });
        }

        const room = Array.isArray(rooms) ? rooms[0] : rooms; // Tomar la primera habitación disponible

        // Insertar reserva en la base de datos
        await pool.query(
            'INSERT INTO reservations (room_number, customer_name, start_date, end_date, status) VALUES ($1, $2, $3, $4, $5)',
            [room.room_id, customerName, startDate, endDate, 'confirmed']
        );

        res.status(200).json({ message: 'Reservation created successfully!', room });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});


// Endpoint para consultar reserva por ID
/**
 * @swagger
 * /reservations/{id}:
 *   get:
 *     summary: Consultar una reserva específica
 *     description: Recupera una reserva existente por su ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la reserva
 *     responses:
 *       200:
 *         description: Detalles de la reserva
 *       404:
 *         description: Reserva no encontrada
 */
app.get('/reservations/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Reservation not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Endpoint para cancelar reserva por ID
/**
 * @swagger
 * /reservations/{id}:
 *   delete:
 *     summary: Cancelar una reserva existente
 *     description: Elimina una reserva de la base de datos.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la reserva
 *     responses:
 *       200:
 *         description: Reserva eliminada correctamente
 *       404:
 *         description: Reserva no encontrada
 */
app.delete('/reservations/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM reservations WHERE reservation_id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Reservation not found' });
        }
        res.status(200).json({ message: 'Reservation deleted successfully' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Iniciar servidor
app.listen(3002, () => {
    console.log('REST API running on port 3002');
    console.log('Swagger Docs available at http://localhost:3002/api-docs');
});
