-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS hub_ingressos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hub_ingressos;

-- Tabela de Eventos
CREATE TABLE IF NOT EXISTS eventos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_evento DATETIME NOT NULL,
    local VARCHAR(255) NOT NULL,
    preco DECIMAL(10, 2) NOT NULL,
    estoque_total INT NOT NULL DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_data (data_evento),
    INDEX idx_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Vendas
CREATE TABLE IF NOT EXISTS vendas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    payment_transaction_id VARCHAR(255),
    catalog_reservation_id VARCHAR(255),
    status ENUM('PENDENTE', 'CONFIRMADA', 'CANCELADA') DEFAULT 'PENDENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES eventos(id),
    INDEX idx_event_id (event_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_event_status (event_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255),
    resource_id INT,
    old_value JSON,
    new_value JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir eventos de exemplo
INSERT INTO eventos (nome, descricao, data_evento, local, preco, estoque_total) VALUES
(
    'Show da Banda X',
    'Espetáculo musical com a renomada Banda X, trazendo os maiores sucessos da carreira.',
    '2026-06-15 20:00:00',
    'Espaço Unimed',
    100.00,
    50
),
(
    'Festival de Música 2026',
    'Festival de múltiplos artistas com várias atrações musicais durante todo o dia.',
    '2026-07-20 14:00:00',
    'Parque da Água Branca',
    200.00,
    100
),
(
    'Teatro - Peça Y',
    'Apresentação teatral clássica com elenco de renomados atores brasileiros.',
    '2026-05-10 20:00:00',
    'Teatro Municipal',
    80.00,
    200
);

-- Criar view de estoque
CREATE OR REPLACE VIEW v_estoque_eventos AS
SELECT 
    e.id,
    e.nome,
    e.preco,
    e.estoque_total,
    COALESCE(
        e.estoque_total - (
            SELECT COUNT(*) FROM vendas 
            WHERE event_id = e.id AND status = 'CONFIRMADA'
        ),
        e.estoque_total
    ) as estoque_disponivel,
    COALESCE(
        (
            SELECT COUNT(*) FROM vendas 
            WHERE event_id = e.id AND status = 'CONFIRMADA'
        ),
        0
    ) as vendido
FROM eventos e;

-- Criar procedures úteis

-- Procedure: Registrar auditoria
DELIMITER $$

CREATE PROCEDURE sp_registrar_auditoria(
    IN p_user_id INT,
    IN p_action VARCHAR(255),
    IN p_resource_type VARCHAR(255),
    IN p_resource_id INT,
    IN p_ip_address VARCHAR(45)
)
BEGIN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
    VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_ip_address);
END$$

DELIMITER ;

-- Procedure: Gerar relatório de vendas
DELIMITER $$

CREATE PROCEDURE sp_relatorio_vendas(
    IN p_event_id INT,
    IN p_data_inicio DATE,
    IN p_data_fim DATE
)
BEGIN
    SELECT 
        e.nome as evento,
        e.preco as preco_unitario,
        COUNT(*) as quantidade_vendida,
        SUM(v.total_price) as receita_total,
        COUNT(DISTINCT v.user_id) as clientes_unicos
    FROM vendas v
    JOIN eventos e ON v.event_id = e.id
    WHERE 
        (p_event_id IS NULL OR v.event_id = p_event_id)
        AND DATE(v.created_at) >= p_data_inicio
        AND DATE(v.created_at) <= p_data_fim
        AND v.status = 'CONFIRMADA'
    GROUP BY e.id, e.nome, e.preco;
END$$

DELIMITER ;
