CREATE TABLE availability (
    room_id SERIAL PRIMARY KEY,
    room_type VARCHAR(50),
    available_date DATE,
    status VARCHAR(20)
);
INSERT INTO availability (room_type, available_date, status) VALUES
('Single', '2024-06-01', 'available'),
('Double', '2024-06-01', 'available');
