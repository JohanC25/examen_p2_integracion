const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(bodyParser.json());

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'inventory_service',
    password: 'post17clave',
    port: 5432,
});

// Configuración de Swagger
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Inventory Service API',
            version: '1.0.0',
            description: 'API para gestionar el inventario de habitaciones',
            contact: {
                name: 'Tu Nombre',
            },
        },
        servers: [
            {
                url: 'http://localhost:3003',
                description: 'Servidor local',
            },
        ],
    },
    apis: ['./index.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Endpoint para registrar una nueva habitación
/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Registrar una nueva habitación
 *     description: Crea un registro para una nueva habitación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomNumber:
 *                 type: integer
 *                 example: 101
 *               roomType:
 *                 type: string
 *                 example: Single
 *               status:
 *                 type: string
 *                 example: available
 *     responses:
 *       201:
 *         description: Habitación registrada exitosamente
 *       500:
 *         description: Error interno del servidor
 */
app.post('/rooms', async (req, res) => {
    const { roomNumber, roomType, status } = req.body;

    try {
        await pool.query(
            'INSERT INTO rooms (room_number, room_type, status) VALUES ($1, $2, $3)',
            [roomNumber, roomType, status]
        );
        res.status(201).json({ message: 'Room registered successfully' });
    } catch (error) {
        console.error('Error registering room:', error.message);
        res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});

// Endpoint para listar todas las habitaciones
/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Listar todas las habitaciones
 *     description: Recupera una lista de todas las habitaciones en el sistema.
 *     responses:
 *       200:
 *         description: Lista de habitaciones recuperada exitosamente
 *       500:
 *         description: Error interno del servidor
 */
app.get('/rooms', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rooms');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error retrieving rooms:', error.message);
        res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});

// Endpoint para actualizar el estado de una habitación
/**
 * @swagger
 * /rooms/{id}:
 *   patch:
 *     summary: Actualizar el estado de una habitación
 *     description: Actualiza el estado de una habitación existente (e.g., disponible, mantenimiento).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la habitación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: maintenance
 *     responses:
 *       200:
 *         description: Estado de la habitación actualizado exitosamente
 *       404:
 *         description: Habitación no encontrada
 *       500:
 *         description: Error interno del servidor
 */
app.patch('/rooms/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const result = await pool.query(
            'UPDATE rooms SET status = $1 WHERE room_id = $2 RETURNING *',
            [status, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }

        res.status(200).json({ message: 'Room status updated successfully', room: result.rows[0] });
    } catch (error) {
        console.error('Error updating room status:', error.message);
        res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});

// Endpoint para eliminar una habitación
/**
 * @swagger
 * /rooms/{id}:
 *   delete:
 *     summary: Eliminar una habitación
 *     description: Elimina una habitación del sistema.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la habitación
 *     responses:
 *       200:
 *         description: Habitación eliminada exitosamente
 *       404:
 *         description: Habitación no encontrada
 *       500:
 *         description: Error interno del servidor
 */
app.delete('/rooms/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM rooms WHERE room_id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Room not found' });
        }

        res.status(200).json({ message: 'Room deleted successfully', room: result.rows[0] });
    } catch (error) {
        console.error('Error deleting room:', error.message);
        res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});

// Iniciar el servidor
app.listen(3003, () => {
    console.log('Inventory Service running on port 3003');
    console.log('Swagger Docs available at http://localhost:3003/api-docs');
});
