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

const getCurrentMonthValue = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const isEventoFinalizado = (dateValue) => {
  const eventoDate = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventoDate < today;
};

function App() {
  const EVENTS_PER_PAGE = 6;
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('São Paulo');
  const [dateFilter, setDateFilter] = useState('Todas as datas');
  const [categoryFilter, setCategoryFilter] = useState('Shows e teatro');
  const [priceFilter, setPriceFilter] = useState('Preço');
  const [calendarMonth, setCalendarMonth] = useState(getCurrentMonthValue());
  const [currentPage, setCurrentPage] = useState(1);
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

  const totalPages = Math.max(1, Math.ceil(filteredEventos.length / EVENTS_PER_PAGE));

  const paginatedEventos = useMemo(() => {
    const start = (currentPage - 1) * EVENTS_PER_PAGE;
    return filteredEventos.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEventos, currentPage, EVENTS_PER_PAGE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, cityFilter, dateFilter, categoryFilter, priceFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const buildVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (currentPage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

  const visiblePages = buildVisiblePages();

  const calendarData = useMemo(() => {
    const [yearText, monthText] = calendarMonth.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;

    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return {
        monthLabel: '',
        weekdayLabels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'],
        calendarCells: [],
      };
    }

    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstWeekday = firstDay.getDay();

    const eventosDoMes = todosEventos
      .filter((evento) => {
        const eventDate = new Date(evento.data);
        return eventDate.getFullYear() === year && eventDate.getMonth() === monthIndex;
      })
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    const eventosByDay = eventosDoMes.reduce((acc, evento) => {
      const day = new Date(evento.data).getDate();
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(evento);
      return acc;
    }, {});

    const calendarCells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      calendarCells.push({ type: 'empty', id: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      calendarCells.push({
        type: 'day',
        id: `day-${day}`,
        day,
        eventos: eventosByDay[day] || [],
      });
    }

    return {
      monthLabel: new Date(year, monthIndex, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
      weekdayLabels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'],
      calendarCells,
    };
  }, [calendarMonth, todosEventos]);

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
                {isEventoFinalizado(selectedEvent.data) && (
                  <span className="detail-pill finalized">Show finalizado</span>
                )}
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
                isFinalized={isEventoFinalizado(selectedEvent.data)}
              />
            </div>
          </section>
        )}

        <div className="event-content-layout">
          <section className="eventos-section">
            <h2>{filteredEventos.length} eventos em {cityFilter === 'Todos os locais' ? 'todos os locais' : cityFilter}</h2>

            <div className="event-list">
              {paginatedEventos.map((evento) => {
                const eventDate = formatListDate(evento.data);

                return (
                  <article key={evento.id} className="event-list-row">
                    <div className="event-date-card">
                      <span>{eventDate.month}</span>
                      <strong>{eventDate.day}</strong>
                      <small>{eventDate.weekday}</small>
                    </div>

                    <div className="event-row-content">
                      <div className="event-row-title">
                        <h3>{evento.nome}</h3>
                        {isEventoFinalizado(evento.data) && (
                          <span className="status-flag finalized">Show finalizado</span>
                        )}
                      </div>
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

            {filteredEventos.length > 0 && (
              <div className="pagination" aria-label="Paginação de eventos">
                <button
                  type="button"
                  className="pagination-button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  Anterior
                </button>

                <div className="pagination-pages">
                  {visiblePages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                      aria-current={page === currentPage ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="pagination-button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Próxima
                </button>
              </div>
            )}

            {filteredEventos.length === 0 && (
              <p className="empty-search-message">Nenhum evento encontrado para sua busca.</p>
            )}
          </section>

          <section className="calendar-section compact">
            <div className="calendar-header">
              <div>
                <h2>Calendário de espetáculos</h2>
                <p>{calendarData.monthLabel}</p>
              </div>
              <label className="calendar-month-picker" htmlFor="calendar-month-input">
                Mês
                <input
                  id="calendar-month-input"
                  type="month"
                  value={calendarMonth}
                  onChange={(e) => setCalendarMonth(e.target.value)}
                />
              </label>
            </div>

            <div className="calendar-grid" role="grid" aria-label="Calendário mensal de espetáculos">
              {calendarData.weekdayLabels.map((weekday) => (
                <span key={weekday} className="calendar-weekday" role="columnheader">{weekday}</span>
              ))}

              {calendarData.calendarCells.map((cell) => {
                if (cell.type === 'empty') {
                  return <div key={cell.id} className="calendar-day empty" aria-hidden="true" />;
                }

                return (
                  <div key={cell.id} className="calendar-day" role="gridcell">
                    <strong>{cell.day}</strong>
                    <div className="calendar-day-events">
                      {cell.eventos.slice(0, 1).map((evento) => (
                        <button
                          key={evento.id}
                          type="button"
                          className={`calendar-event-chip ${isEventoFinalizado(evento.data) ? 'finalized' : ''}`}
                          onClick={() => setSelectedEvent(evento)}
                        >
                          {evento.nome}
                        </button>
                      ))}
                      {cell.eventos.length > 1 && (
                        <span className="calendar-more-events">+{cell.eventos.length - 1}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
