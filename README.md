# Hub de Ingressos Healthbit

Sistema distribuído de venda de ingressos com arquitetura baseada em microserviços, focado em consistência de estoque e escalabilidade.

**Tecnologias:** React, PHP, Python e MySQL

## Estrutura

```
hub-ingressos/
├── backend-php/
│   ├── config.php
│   ├── bootstrap.php
│   └── api.php (endpoint)
│   └── src/
│       ├── Application/
│       ├── Contracts/
│       ├── Http/
│       └── Infrastructure/
├── backend-python/
│   ├── app.py
│   ├── models.py
│   └── requirements.txt
├── frontend-react/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── styles/
│   │   └── App.jsx
│   └── package.json
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── ARCHITECTURE.md
│   └── FINAL_ANSWERS.md
├── sql/
│   └── schema.sql
└── README.md
```

## Decisões Arquiteturais

### Controle de Concorrência

O serviço de catálogo implementa controle de concorrência utilizando mecanismos de lock (mutex) e transações, garantindo que múltiplas requisições simultâneas não resultem em overbooking de ingressos.

### Comunicação síncrona

A comunicação entre o serviço de Vendas (PHP) e o serviço de Catálogo (Python) é realizada de forma síncrona via HTTP. Essa abordagem foi escolhida pela simplicidade de implementação e por garantir resposta imediata ao usuário durante o fluxo de compra. Em cenários de maior escala, essa comunicação poderia evoluir para um modelo assíncrono com uso de mensageria.

### Reserva de estoque

Para evitar a venda de ingressos além da capacidade disponível (overbooking), o serviço de Catálogo realiza uma validação de estoque antes da confirmação da compra. A abordagem considera a possibilidade de implementação de reservas temporárias, garantindo consistência mesmo em cenários concorrentes.

### Separação de serviços

O sistema foi dividido em três serviços independentes (Frontend, Vendas e Catálogo), cada um com responsabilidades bem definidas. Essa separação segue o princípio de baixo acoplamento e alta coesão, facilitando a manutenção, evolução e escalabilidade da aplicação.

### Escalabilidade futura

A arquitetura foi pensada para suportar crescimento. Em cenários de alta demanda, é possível escalar os serviços de forma independente, além de incorporar soluções como cache (ex: Redis), filas de mensageria (ex: RabbitMQ/Kafka) e balanceamento de carga para melhorar a performance e resiliência do sistema.

## Como Executar

### Pré-requisitos

- XAMPP (PHP 8.0+, MySQL 5.7+)
- Python 3.8+ e pip
- Node.js 14+ e npm

### 1. Banco de Dados (MySQL)

```bash
# Abrir MySQL via XAMPP
# Executar script
mysql -u root < sql/schema.sql

# Ou importar via phpMyAdmin
# 1. Acesse http://localhost/phpmyadmin
# 2. Crie banco "hub_ingressos"
# 3. Importe arquivo sql/schema.sql
```

### 2. Backend Python (Serviço de Catálogo)

```bash
cd backend-python

# Instalar dependências
pip install -r requirements.txt

# Executar servidor
python app.py

# Servidor disponível em: http://localhost:5000
# Health check: http://localhost:5000/health
```

### 3. Backend PHP (Serviço de Vendas)

```bash
# Colocar pasta em: C:\xampp\htdocs\hub-ingressos

# Servidor disponível em: http://localhost/hub-ingressos/backend-php/api.php

# Criar arquivo .htaccess para reescrita de URL:
cat > backend-php/.htaccess << 'EOF'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /hub-ingressos/backend-php/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^api/(.*)$ api.php?route=$1 [QSA,L]
</IfModule>
EOF
```

### 4. Frontend React

```bash
cd frontend-react

# Instalar dependências
npm install

# Executar desenvolvimento
npm start

# Disponível em: http://localhost:3000

# Build para produção
npm run build
```

## Testando a Aplicação

### Via Frontend React

1. Abra http://localhost:3000
2. Clique em "Comprar Ingresso" em qualquer evento
3. Observe estados de carregamento e sucesso/erro

### Via cURL (Catálogo)

```bash
# Listar eventos
curl -X GET http://localhost:5000/api/v1/catalogo/eventos

# Verificar saúde do serviço
curl -X GET http://localhost:5000/health
```

### Via cURL (Vendas)

```bash
# Processar compra
curl -X POST "http://localhost/hub-ingressos/backend-php/api.php?route=compras" \
  -H "Content-Type: application/json" \
  -d '{
         "event_id": 10,
         "quantity": 2,
      "payment_data": {
         "method": "credit_card",
         "card_number": "4111111111111111",
         "expiry": "12/25",
      "cvv": "123"
    }
  }'
```

## Testando via Postman

### Base URLs

```text
PHP:    http://localhost/hub-ingressos/backend-php/api.php
Python: http://localhost:5000
```

### Antes de testar

1. Inicie Apache e MySQL no XAMPP
2. Inicie o backend Python em `http://localhost:5000`
3. Garanta que o banco `hub_ingressos` já foi criado

### 1. Comprar ingresso pelo serviço PHP

**Método:** `POST`

**URL:**

```text
http://localhost/hub-ingressos/backend-php/api.php?route=compras
```

**Headers:**

```text
Content-Type: application/json
```

**Body (raw JSON):**

```json
{
   "event_id": 10,
   "quantity": 2,
   "payment_data": {
      "method": "credit_card",
      "card_number": "4111111111111111",
      "expiry": "12/25",
      "cvv": "123"
   }
}
```

### 2. Cancelar compra pelo serviço PHP

**Método:** `POST`

**URL:**

```text
http://localhost/hub-ingressos/backend-php/api.php?route=cancelar
```

**Body (raw JSON):**

```json
{
   "venda_id": 1
}
```

### 3. Listar eventos recentes do banco

**Método:** `GET`

**URL:**

```text
http://localhost/hub-ingressos/backend-php/api.php?route=eventos-novos&limit=10
```

### 4. Listar eventos do catálogo sincronizado

**Método:** `GET`

**URL:**

```text
http://localhost/hub-ingressos/backend-php/api.php?route=catalogo-eventos
```

### 5. Testar o serviço Python diretamente

**Health check:**

```text
GET http://localhost:5000/health
```

**Listar eventos:**

```text
GET http://localhost:5000/api/v1/catalogo/eventos
```

**Reservar ingressos:**

```text
POST http://localhost:5000/api/v1/catalogo/reservar
```

**Body (raw JSON):**

```json
{
   "id_evento": 10,
   "quantidade": 1
}
```

### Fluxo recomendado no Postman

1. Teste `GET /health`
2. Teste `GET /api.php?route=eventos-novos&limit=10`
3. Faça `POST /api.php?route=compras`
4. Copie o `venda_id` retornado
5. Faça `POST /api.php?route=cancelar`


## Endpoints Principais

### Serviço de Catálogo (Python)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/catalogo/eventos` | Listar eventos |
| GET | `/api/v1/catalogo/eventos/{id}` | Detalhes do evento |
| POST | `/api/v1/catalogo/reservar` | Reservar ingressos |
| PUT | `/api/v1/catalogo/reservas/{id}/liberar` | Liberar reserva |
| GET | `/health` | Status do serviço |

### Serviço de Vendas (PHP)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api.php?route=compras` | Processar compra |
| POST | `/api.php?route=cancelar` | Cancelar compra |
| GET | `/api.php?route=eventos-novos&limit=10` | Listar eventos recentes |
| GET | `/api.php?route=catalogo-eventos` | Listar eventos para sincronização |

## Fluxo de Compra

```
1. Frontend clica "Comprar"
   ↓
2. PHP recebe validação
   ↓
3. PHP → Python: Reservar estoque
   ↓
4. Python valida e reserva
   ↓
5. PHP processa pagamento
   ↓
6. Python confirma reserva
   ↓
7. PHP salva venda no banco
   ↓
8. Frontend mostra sucesso
```

## Segurança

- Validação de entrada em todas as camadas
- Lock para operações concorrentes
- Transações ACID no banco
- Timeout nas requisições HTTP
- Error handling robusto

## Performance

- Cache com Redis (preparada para uso com Redis)
- Prepared statements para SQL
- Índices no banco de dados
- Compressão de responses

### Python: ModuleNotFoundError
```bash
pip install flask requests python-dotenv
```

### PHP: CORS Error
Verificar CORS headers em `backend-php/api.php`

### MySQL: Connection Refused
Verificar se MySQL está rodando (XAMPP)

### Frontend: API Timeout
Verificar se Python está rodando na porta 5000

### Thread-Safety
Catálogo usa Lock (mutex) para evitar race conditions

### Reservas Expiram
Reservas têm expiração de 10 minutos


