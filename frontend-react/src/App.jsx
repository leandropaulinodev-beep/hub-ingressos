import React, { useEffect, useMemo, useRef, useState } from 'react';
import PurchaseButton from './components/PurchaseButton';
import { listarNovosEventos } from './services/api';
import './styles/App.css';

const formatListDate = (dateValue) => {
  const date = new Date(dateValue);
  const month = date.toLocaleDateString('pt-BR', { month: 'short' });
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });

  return {
    day: String(date.getDate()).padStart(2, '0'),
    month,
    weekday,
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    full: date.toLocaleDateString('pt-BR'),
  };
};

const advanceOption = (options, currentValue) => {
  const currentIndex = options.indexOf(currentValue);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % options.length : 0;
  return options[nextIndex];
};

const inferCategory = (evento) => {
  const texto = `${evento.nome} ${evento.descricao || ''}`.toLowerCase();

  if (texto.includes('teatro') || texto.includes('peça')) {
    return 'Teatro';
  }

  if (texto.includes('festival')) {
    return 'Festivais';
  }

  return 'Shows';
};

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('São Paulo');
  const [dateFilter, setDateFilter] = useState('Todas as datas');
  const [categoryFilter, setCategoryFilter] = useState('Shows e teatro');
  const [priceFilter, setPriceFilter] = useState('Preço');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [novosEventos, setNovosEventos] = useState([]);
  const [loadingNovosEventos, setLoadingNovosEventos] = useState(true);
  const [novosEventosError, setNovosEventosError] = useState('');
  const carouselRef = useRef(null);

  const cityOptions = ['São Paulo', 'Todos os locais'];
  const dateOptions = ['Todas as datas', 'Próximos 30 dias', 'Este mês'];
  const categoryOptions = ['Shows e teatro', 'Shows', 'Teatro', 'Festivais'];
  const priceOptions = ['Preço', 'Até R$ 100', 'R$ 101 a R$ 200', 'Acima de R$ 200'];

  const eventosBase = useMemo(
    () => [
      {
        id: 7,
        nome: 'Show da Banda X',
        data: '2026-06-15',
        local: 'Espaço Unimed',
        cidade: 'São Paulo, Brasil',
        estoqueDisponivel: 50,
        preco: 100,
        descricao: 'Uma noite especial com os maiores sucessos da Banda X, estrutura premium de som e experiência completa para fãs de música ao vivo.',
      },
      {
        id: 8,
        nome: 'Festival de Música 2026',
        data: '2026-07-20',
        local: 'Parque da Água Branca',
        cidade: 'São Paulo, Brasil',
        estoqueDisponivel: 100,
        preco: 200,
        descricao: 'Festival com atrações nacionais, áreas gastronômicas e apresentações durante todo o dia em um ambiente aberto e familiar.',
      },
      {
        id: 9,
        nome: 'Teatro - Peça Y',
        data: '2026-05-10',
        local: 'Teatro Municipal',
        cidade: 'São Paulo, Brasil',
        estoqueDisponivel: 200,
        preco: 80,
        descricao: 'Espetáculo teatral com produção clássica, elenco renomado e narrativa envolvente para todos os públicos.',
      },
    ],
    []
  );

  useEffect(() => {
    const carregarNovosEventos = async () => {
      setLoadingNovosEventos(true);
      setNovosEventosError('');

      const response = await listarNovosEventos(12);
      if (response.success) {
        setNovosEventos(response.data?.data?.eventos || []);
      } else {
        setNovosEventosError(response.error || 'Não foi possível carregar os novos eventos.');
      }

      setLoadingNovosEventos(false);
    };

    carregarNovosEventos();
  }, []);

  const eventosDoBanco = useMemo(
    () => novosEventos.map((evento) => ({
      id: Number(evento.id),
      nome: evento.nome,
      data: String(evento.data_evento).slice(0, 10),
      local: evento.local,
      cidade: 'São Paulo, Brasil',
      estoqueDisponivel: Number(evento.estoque_total),
      preco: Number(evento.preco),
      descricao: evento.descricao || 'Confira os detalhes completos deste evento e garanta seu ingresso.',
    })),
    [novosEventos]
  );

  const todosEventos = useMemo(() => {
    const eventosMap = new Map();

    [...eventosBase, ...eventosDoBanco].forEach((evento) => {
      eventosMap.set(evento.id, {
        ...eventosMap.get(evento.id),
        ...evento,
      });
    });

    return Array.from(eventosMap.values()).sort((a, b) => a.id - b.id);
  }, [eventosBase, eventosDoBanco]);

  const filteredEventos = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return todosEventos.filter((evento) => {
      const eventoDate = new Date(evento.data);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const cityMatches = cityFilter === 'Todos os locais'
        || evento.cidade.toLowerCase().includes(cityFilter.toLowerCase());

      const searchMatches = !normalizedTerm
        || evento.nome.toLowerCase().includes(normalizedTerm)
        || evento.local.toLowerCase().includes(normalizedTerm)
        || evento.cidade.toLowerCase().includes(normalizedTerm);

      const eventCategory = inferCategory(evento);
      const categoryMatches = categoryFilter === 'Shows e teatro' || categoryFilter === eventCategory;

      const dateMatches = (() => {
        if (dateFilter === 'Todas as datas') {
          return true;
        }

        if (dateFilter === 'Próximos 30 dias') {
          const dateLimit = new Date(today);
          dateLimit.setDate(dateLimit.getDate() + 30);
          return eventoDate >= today && eventoDate <= dateLimit;
        }

        if (dateFilter === 'Este mês') {
          return eventoDate.getMonth() === today.getMonth()
            && eventoDate.getFullYear() === today.getFullYear();
        }

        return true;
      })();

      const priceMatches = (() => {
        if (priceFilter === 'Preço') {
          return true;
        }

        if (priceFilter === 'Até R$ 100') {
          return evento.preco <= 100;
        }

        if (priceFilter === 'R$ 101 a R$ 200') {
          return evento.preco >= 101 && evento.preco <= 200;
        }

        if (priceFilter === 'Acima de R$ 200') {
          return evento.preco > 200;
        }

        return true;
      })();

      return cityMatches && searchMatches && categoryMatches && dateMatches && priceMatches;
    });
  }, [todosEventos, searchTerm, cityFilter, dateFilter, categoryFilter, priceFilter]);

  const eventosEmDestaque = useMemo(() => {
    if (eventosDoBanco.length > 0) {
      return eventosDoBanco.slice(0, 8);
    }

    return eventosBase.slice(0, 8);
  }, [eventosBase, eventosDoBanco]);

  const scrollCarousel = (direction) => {
    if (!carouselRef.current) {
      return;
    }

    const amount = direction === 'left' ? -320 : 320;
    carouselRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="top-strip">
          Somos o seu hub para descobrir, acompanhar e comprar ingressos dos eventos que movimentam São Paulo.
        </div>

        <div className="hero-shell">
          <div className="hero-nav">
            <div className="brand-lockup">
              <span className="brand-mark"></span>
              <span className="brand-text"></span>
            </div>

            <div className="search-box search-box-header">
              <input
                type="text"
                placeholder="Busque por eventos, artistas e locais"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Buscar evento"
              />
            </div>

            <nav className="hero-links">
              <button type="button">Explorar</button>
              <button type="button">Favoritos</button>
              <button type="button">Meus ingressos</button>
            </nav>
          </div>

          <div className="hero-copy">
            <span className="hero-kicker">Cidade em destaque</span>
            <h1>Hub ingressos</h1>
            <p>Descubra shows, festivais e espetáculos em alta e encontre seu próximo ingresso de forma simples e rápida.</p>
          </div>

          <section className="novos-eventos-section hero-panel">
            <div className="novos-eventos-header">
              <h2>Eventos em alta em São Paulo</h2>
              <div className="carousel-controls">
                <button onClick={() => scrollCarousel('left')} aria-label="Voltar eventos">
                  ◀
                </button>
                <button onClick={() => scrollCarousel('right')} aria-label="Avançar eventos">
                  ▶
                </button>
              </div>
            </div>

            {loadingNovosEventos && <p className="novos-eventos-status">Carregando novos eventos...</p>}
            {!loadingNovosEventos && novosEventosError && (
              <p className="novos-eventos-status error">{novosEventosError}</p>
            )}

            {!loadingNovosEventos && !novosEventosError && (
              <div className="novos-eventos-carousel" ref={carouselRef}>
                {eventosEmDestaque.map((evento, index) => (
                  <article key={evento.id} className="novo-evento-card hero-card">
                    <div className={`hero-card-thumb thumb-${(index % 4) + 1}`}>
                      <span className="hero-rank">#{index + 1}</span>
                    </div>
                    <div className="hero-card-body">
                      <h3>{evento.nome}</h3>
                      <p>{formatListDate(evento.data).full}</p>
                      <p>{evento.local}</p>
                      <button
                        className="mini-action-button"
                        onClick={() => setSelectedEvent(evento)}
                      >
                        Confira
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </header>

      <main className="app-main">
        <section className="filters-bar">
          <button
            className={`filter-pill ${cityFilter === 'São Paulo' ? 'active' : ''}`}
            type="button"
            onClick={() => setCityFilter((current) => advanceOption(cityOptions, current))}
            title="Clique para alternar o local"
          >
            {cityFilter}
          </button>
          <button
            className={`filter-pill ${dateFilter !== 'Todas as datas' ? 'active' : ''}`}
            type="button"
            onClick={() => setDateFilter((current) => advanceOption(dateOptions, current))}
            title="Clique para alternar o período"
          >
            {dateFilter}
          </button>
          <button
            className={`filter-pill ${categoryFilter !== 'Shows e teatro' ? 'active' : ''}`}
            type="button"
            onClick={() => setCategoryFilter((current) => advanceOption(categoryOptions, current))}
            title="Clique para alternar a categoria"
          >
            {categoryFilter}
          </button>
          <button
            className={`filter-pill ${priceFilter !== 'Preço' ? 'active' : ''}`}
            type="button"
            onClick={() => setPriceFilter((current) => advanceOption(priceOptions, current))}
            title="Clique para alternar a faixa de preço"
          >
            {priceFilter}
          </button>
        </section>

        {selectedEvent && (
          <section className="event-detail-section">
            <button
              className="back-to-list-button"
              onClick={() => setSelectedEvent(null)}
            >
              Voltar para lista
            </button>

            <div className="event-detail-card">
              <div className="event-detail-meta">
                <span className="detail-pill">Evento selecionado</span>
                <span className="detail-pill secondary">R$ {Number(selectedEvent.preco || 0).toFixed(2)}</span>
              </div>
              <h2>{selectedEvent.nome}</h2>
              <p><strong>Data:</strong> {formatListDate(selectedEvent.data).full}</p>
              <p><strong>Local:</strong> {selectedEvent.local}</p>
              <p><strong>Estoque disponível:</strong> {selectedEvent.estoqueDisponivel}</p>
              <p className="event-detail-description">{selectedEvent.descricao}</p>

              <PurchaseButton
                eventId={selectedEvent.id}
                eventName={selectedEvent.nome}
                quantity={1}
                maxQuantity={selectedEvent.estoqueDisponivel}
              />
            </div>
          </section>
        )}

        <section className="eventos-section">
          <h2>{filteredEventos.length} eventos em {cityFilter === 'Todos os locais' ? 'todos os locais' : cityFilter}</h2>

          <div className="event-list">
            {filteredEventos.map((evento) => {
              const eventDate = formatListDate(evento.data);

              return (
                <article key={evento.id} className="event-list-row">
                  <div className="event-date-card">
                    <span>{eventDate.month}</span>
                    <strong>{eventDate.day}</strong>
                    <small>{eventDate.weekday}</small>
                  </div>

                  <div className="event-row-content">
                    <h3>{evento.nome}</h3>
                    <p>{eventDate.time} • {evento.cidade} • {evento.local}</p>
                    <p className="event-row-description">{evento.descricao}</p>
                  </div>

                  <div className="event-row-actions">
                    <button
                      className="row-link-button"
                      onClick={() => setSelectedEvent(evento)}
                    >
                      Ver ingressos
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredEventos.length === 0 && (
            <p className="empty-search-message">Nenhum evento encontrado para sua busca.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
