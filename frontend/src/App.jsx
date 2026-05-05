import { useEffect, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const YOUR_WHATSAPP = "5531987194118";

function formatNumber(n) {
  return String(n).padStart(3, "0");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function Admin() {
  const [adminPassword, setAdminPassword] = useState(
    localStorage.getItem("adminPassword") || ""
  );
  const [isLogged, setIsLogged] = useState(
    Boolean(localStorage.getItem("adminPassword"))
  );

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState({
    title: "",
    prize: "",
    price: 2,
    imageUrl: "",
    winner: "",
  });
  const [imageFile, setImageFile] = useState(null);

  function adminHeaders(json = true) {
    const headers = {
      "x-admin-password": adminPassword,
    };

    if (json) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  useEffect(() => {
    if (isLogged) {
      loadOrders();
      loadConfig();
      loadStats();
    }
  }, [isLogged]);

  function loginAdmin(e) {
    e.preventDefault();

    if (!adminPassword.trim()) {
      alert("Digite a senha do admin.");
      return;
    }

    localStorage.setItem("adminPassword", adminPassword);
    setIsLogged(true);
  }

  function logoutAdmin() {
    localStorage.removeItem("adminPassword");
    setIsLogged(false);
    setAdminPassword("");
  }

  async function loadOrders() {
    const res = await fetch(`${API_URL}/admin`, {
      headers: adminHeaders(false),
    });

    if (res.status === 401) {
      alert("Senha admin inválida.");
      logoutAdmin();
      return;
    }

    const data = await res.json();
    setOrders(data);
  }

  async function loadConfig() {
    const res = await fetch(`${API_URL}/config`);
    const data = await res.json();
    setConfig(data);
  }

  async function loadStats() {
    const res = await fetch(`${API_URL}/stats`);
    const data = await res.json();
    setStats(data);
  }

  async function refreshAdmin() {
    await loadOrders();
    await loadConfig();
    await loadStats();
  }

  async function saveConfig() {
    const res = await fetch(`${API_URL}/admin/config`, {
      method: "POST",
      headers: adminHeaders(true),
      body: JSON.stringify(config),
    });

    if (!res.ok) {
      alert("Erro ao salvar configurações. Verifique a senha.");
      return;
    }

    alert("Configurações salvas!");
    await refreshAdmin();
  }

  async function uploadImage() {
    if (!imageFile) {
      alert("Escolha uma imagem primeiro.");
      return;
    }

    const formData = new FormData();
    formData.append("image", imageFile);

    const res = await fetch(`${API_URL}/admin/upload`, {
      method: "POST",
      headers: adminHeaders(false),
      body: formData,
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.message || "Erro ao enviar imagem.");
      return;
    }

    alert("Imagem atualizada!");
    setImageFile(null);
    await refreshAdmin();
  }

  async function removeImage() {
    const confirmRemove = window.confirm("Remover imagem do prêmio?");
    if (!confirmRemove) return;

    await fetch(`${API_URL}/admin/image`, {
      method: "DELETE",
      headers: adminHeaders(false),
    });

    alert("Imagem removida!");
    await refreshAdmin();
  }

  async function markAsPaid(id) {
    const confirmPay = window.confirm("Confirmar pagamento dessa reserva?");
    if (!confirmPay) return;

    await fetch(`${API_URL}/admin/${id}/pay`, {
      method: "PATCH",
      headers: adminHeaders(false),
    });

    await refreshAdmin();
    alert("Reserva marcada como paga!");
  }

  async function removeWinner() {
    const confirmRemove = window.confirm("Remover o ganhador atual?");
    if (!confirmRemove) return;

    const res = await fetch(`${API_URL}/admin/winner`, {
      method: "DELETE",
      headers: adminHeaders(false),
    });

    const data = await res.json();

    if (!data.ok) {
      alert("Erro ao remover ganhador.");
      return;
    }

    await refreshAdmin();
    alert("Ganhador removido!");
  }

  async function deleteOrder(id) {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja remover essa reserva?"
    );

    if (!confirmDelete) return;

    await fetch(`${API_URL}/admin/${id}`, {
      method: "DELETE",
      headers: adminHeaders(false),
    });

    await refreshAdmin();
    alert("Reserva removida com sucesso!");
  }

  async function resetRaffle() {
    const confirmReset = window.confirm(
      "Tem certeza que deseja apagar TODAS as reservas e começar uma nova rifa?"
    );

    if (!confirmReset) return;

    const secondConfirm = window.confirm(
      "Atenção: isso vai liberar todos os 200 números. Confirmar?"
    );

    if (!secondConfirm) return;

    await fetch(`${API_URL}/admin/reset`, {
      method: "DELETE",
      headers: adminHeaders(false),
    });

    await refreshAdmin();
    alert("Rifa reiniciada! Um backup foi criado automaticamente.");
  }

  async function drawWinner() {
    const confirmDraw = window.confirm(
      "Deseja sortear agora entre os números pagos?"
    );

    if (!confirmDraw) return;

    const res = await fetch(`${API_URL}/admin/draw`, {
      method: "POST",
      headers: adminHeaders(false),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Erro ao sortear.");
      return;
    }

    await refreshAdmin();

    alert(
      `Ganhador: ${data.winner.name}\nNúmero: ${formatNumber(
        data.winner.number
      )}`
    );
  }

  if (!isLogged) {
    return (
      <div className="page">
        <header className="hero">
          <h1>Login Admin</h1>
          <p>Digite a senha para acessar o painel da rifa</p>
        </header>

        <section className="config-box">
          <form onSubmit={loginAdmin}>
            <label>Senha admin</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Digite a senha"
            />

            <button type="submit">Entrar no painel</button>
          </form>
        </section>
      </div>
    );
  }

  const paidOrders = orders.filter((order) => order.status === "paid");
  const paidNumbersCount = paidOrders.reduce((acc, order) => {
    return acc + JSON.parse(order.numbers).length;
  }, 0);

  return (
    <div className="page">
      <header className="hero">
        <h1>Painel Admin</h1>
        <p>Controle da rifa, prêmio, valor, reservas e sorteio</p>
      </header>

      <button className="delete-btn" onClick={logoutAdmin}>
        Sair do admin
      </button>

      {stats && (
        <section className="progress-box">
          <h2>Progresso da rifa</h2>

          <div className="progress-bar">
            <div style={{ width: `${stats.progressPercent}%` }} />
          </div>

          <p>
            <strong>{stats.paidNumbers}</strong> pagos de{" "}
            <strong>{stats.totalTickets}</strong> números (
            {stats.progressPercent}%)
          </p>

          <p>
            Pendentes: <strong>{stats.pendingNumbers}</strong> · Livres:{" "}
            <strong>{stats.freeNumbers}</strong>
          </p>
        </section>
      )}

      <section className="config-box">
        <h2>Configurações da Rifa</h2>

        <label>Título da rifa</label>
        <input
          value={config.title}
          onChange={(e) => setConfig({ ...config, title: e.target.value })}
          placeholder="Ex: Rifa Da Nina"
        />

        <label>Nome do prêmio</label>
        <input
          value={config.prize}
          onChange={(e) => setConfig({ ...config, prize: e.target.value })}
          placeholder="Ex: Cesta especial"
        />

        <label>Valor por número</label>
        <input
          type="number"
          step="0.01"
          value={config.price}
          onChange={(e) => setConfig({ ...config, price: e.target.value })}
          placeholder="Ex: 2"
        />

        <button className="paid-btn" onClick={saveConfig}>
          Salvar título, prêmio e valor
        </button>

        <div className="image-admin">
          <h3>Imagem do prêmio</h3>

          {config.imageUrl ? (
            <img
              src={`${API_URL}${config.imageUrl}`}
              alt="Imagem atual do prêmio"
            />
          ) : (
            <p>Nenhuma imagem cadastrada.</p>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
          />

          <div className="admin-actions">
            <button className="paid-btn" onClick={uploadImage}>
              Salvar nova imagem
            </button>

            <button className="delete-btn" onClick={removeImage}>
              Remover imagem
            </button>
          </div>
        </div>
      </section>

      <section className="draw-admin-box">
        <h2>Sorteio</h2>

        <p>
          Números pagos participando: <strong>{paidNumbersCount}</strong>
        </p>

        {config.winner ? (
          <div className="winner-mini">
            <strong>Último ganhador:</strong>
            <span>
              {JSON.parse(config.winner).name} — número{" "}
              {formatNumber(JSON.parse(config.winner).number)}
            </span>
          </div>
        ) : (
          <p>Nenhum sorteio feito ainda.</p>
        )}

        <div className="admin-actions">
          <button className="paid-btn" onClick={drawWinner}>
            Sortear ganhador
          </button>

          <button className="delete-btn" onClick={removeWinner}>
            Remover ganhador
          </button>

          <a className="public-link" href="/sorteio" target="_blank">
            Abrir painel público
          </a>
        </div>
      </section>

      <section className="danger-zone">
        <h2>Nova rifa</h2>
        <p>
          Use isso quando for começar outro sorteio e quiser liberar todos os
          números.
        </p>
        <button className="delete-btn" onClick={resetRaffle}>
          Apagar todas as reservas
        </button>
      </section>

      <button className="refresh-btn" onClick={refreshAdmin}>
        Atualizar painel
      </button>

      <div className="numbers-box">
        {orders.length === 0 ? (
          <p>Nenhuma reserva ainda.</p>
        ) : (
          orders.map((order) => {
            const numbers = JSON.parse(order.numbers);
            const total = numbers.length * Number(config.price || 0);

            return (
              <div key={order.id} className="order-card">
                <h3>{order.name}</h3>

                <p>
                  <strong>WhatsApp:</strong> {order.whatsapp}
                </p>

                <p>
                  <strong>Números:</strong>{" "}
                  {numbers.map((n) => formatNumber(n)).join(", ")}
                </p>

                <p>
                  <strong>Quantidade:</strong> {numbers.length} número(s)
                </p>

                <p>
                  <strong>Total:</strong> {formatMoney(total)}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  <span className={`status ${order.status}`}>
                    {order.status === "pending" && "Pendente"}
                    {order.status === "paid" && "Pago"}
                    {order.status === "cancelled" && "Cancelado"}
                  </span>
                </p>

                <div className="admin-actions">
                  {order.status === "pending" && (
                    <button
                      className="paid-btn"
                      onClick={() => markAsPaid(order.id)}
                    >
                      Marcar como pago
                    </button>
                  )}

                  <button
                    className="delete-btn"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Remover reserva
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DrawPanel() {
  const [config, setConfig] = useState({
    title: "",
    prize: "",
    price: 2,
    imageUrl: "",
    winner: "",
  });
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    loadPublicData();
  }, []);

  async function loadPublicData() {
    const configRes = await fetch(`${API_URL}/config`);
    const configData = await configRes.json();
    setConfig(configData);

    const paidRes = await fetch(`${API_URL}/public/paid`);
    const paidData = await paidRes.json();
    setOrders(paidData);
  }

  const participants = orders.flatMap((order) => {
    const numbers = JSON.parse(order.numbers);
    return numbers.map((number) => ({
      name: order.name,
      number,
    }));
  });

  const winner = config.winner ? JSON.parse(config.winner) : null;

  return (
    <div className="draw-page">
      <section className="draw-hero">
        <div>
          <p className="draw-kicker">Painel público do sorteio</p>
          <h1>{config.title}</h1>
          <p>{config.prize}</p>
        </div>

        <div className="draw-prize">
          {config.imageUrl ? (
            <img src={`${API_URL}${config.imageUrl}`} alt="Prêmio" />
          ) : (
            <div className="empty-image">Sem imagem</div>
          )}
        </div>
      </section>

      <section className="draw-stats">
        <div>
          <span>Participantes pagos</span>
          <strong>{orders.length}</strong>
        </div>

        <div>
          <span>Números pagos</span>
          <strong>{participants.length}</strong>
        </div>

        <div>
          <span>Valor por número</span>
          <strong>{formatMoney(config.price)}</strong>
        </div>
      </section>

      {winner && (
        <section className="winner-box">
          <p>🎉 Ganhador sorteado</p>
          <h2>{winner.name}</h2>
          <strong>Número {formatNumber(winner.number)}</strong>
        </section>
      )}

      <section className="participants-box">
        <h2>Nomes e números confirmados</h2>

        {participants.length === 0 ? (
          <p>Nenhum pagamento confirmado ainda.</p>
        ) : (
          <div className="participants-grid">
            {participants.map((item, index) => (
              <div
                key={`${item.name}-${item.number}-${index}`}
                className="participant-card"
              >
                <strong>{formatNumber(item.number)}</strong>
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Home() {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [config, setConfig] = useState({
    title: "",
    prize: "",
    price: 2,
    imageUrl: "",
  });

  const totalValue = selected.length * Number(config.price || 0);

  useEffect(() => {
    loadTickets();
    loadConfig();
  }, []);

  async function loadConfig() {
    const res = await fetch(`${API_URL}/config`);
    const data = await res.json();
    setConfig(data);
  }

  async function loadTickets() {
    const res = await fetch(`${API_URL}/tickets`);
    const data = await res.json();
    setTickets(data);
  }

  function toggleNumber(number, status) {
    if (status === "taken") return;

    if (selected.includes(number)) {
      setSelected((prev) => prev.filter((n) => n !== number));
    } else {
      setSelected((prev) => [...prev, number]);
    }
  }

  async function buyTickets(e) {
    e.preventDefault();

    if (!name || !whatsapp || selected.length === 0) {
      alert("Preencha nome, WhatsApp e escolha pelo menos 1 número.");
      return;
    }

    const res = await fetch(`${API_URL}/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        whatsapp,
        numbers: selected,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Erro ao reservar números.");
      loadTickets();
      return;
    }

    const numerosFormatados = selected.map((n) => formatNumber(n)).join(", ");

    const mensagem = `Olá! Acabei de escolher os números da rifa.

Nome: ${name}
WhatsApp: ${whatsapp}
Rifa: ${config.title}
Prêmio: ${config.prize}
Números escolhidos: ${numerosFormatados}
Quantidade: ${selected.length} número(s)
Valor por número: ${formatMoney(config.price)}
Total: ${formatMoney(totalValue)}

Pode me enviar a chave Pix?`;

    window.open(
      `https://wa.me/${YOUR_WHATSAPP}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );

    alert("Pedido enviado! Agora finalize pelo WhatsApp.");
    window.location.reload();
  }

  return (
    <div className="page">
      <header className="hero hero-with-prize">
        <div className="hero-text">
          <img
            src="/images/logo.png"
            alt="Angel Modas Sorteio"
            className="hero-logo"
          />

          <h1>{config.title}</h1>

          <p className="hero-subtitle">
            Escolha seus números e envie o pedido pelo WhatsApp
          </p>
        </div>

        <div className="prize-card">
          {config.imageUrl ? (
            <img src={`${API_URL}${config.imageUrl}`} alt="Prêmio da rifa" />
          ) : (
            <div className="empty-image">Sem imagem</div>
          )}

          <h2>{config.prize}</h2>
        </div>
      </header>

      <main className="content">
        <section className="numbers-box">
          <h2>Escolha seus números</h2>

          <div className="numbers-grid">
            {tickets.map((ticket) => (
              <button
                key={ticket.number}
                className={
                  ticket.status === "taken"
                    ? "number taken"
                    : selected.includes(ticket.number)
                    ? "number selected"
                    : "number"
                }
                onClick={() => toggleNumber(ticket.number, ticket.status)}
              >
                {formatNumber(ticket.number)}
              </button>
            ))}
          </div>
        </section>

        <aside className="checkout">
          <h2>Finalizar</h2>

          <div className="summary">
            <p>Números escolhidos:</p>
            <strong>
              {selected.length > 0
                ? selected.map((n) => formatNumber(n)).join(", ")
                : "Nenhum"}
            </strong>

            <p className="summary-space">Quantidade:</p>
            <strong>{selected.length} número(s)</strong>

            <p className="summary-space">Valor por número:</p>
            <strong>{formatMoney(config.price)}</strong>

            <p className="summary-space">Total:</p>
            <strong>{formatMoney(totalValue)}</strong>
          </div>

          <form onSubmit={buyTickets}>
            <label>Nome e sobrenome</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label>WhatsApp</label>
            <input
              type="text"
              placeholder="Ex: 31999999999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />

            <button type="submit">Enviar pedido no WhatsApp</button>
          </form>
        </aside>
      </main>
    </div>
  );
}

function App() {
  if (window.location.pathname === "/admin") return <Admin />;
  if (window.location.pathname === "/sorteio") return <DrawPanel />;
  return <Home />;
}

export default App;
