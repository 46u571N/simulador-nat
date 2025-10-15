// Importar hooks de React
const { useState, useEffect } = React;

// Importar iconos de Lucide
const { Send, Router, Wifi, RefreshCw, Trash2, Info, AlertCircle, Clock, Zap } = lucide;

// Componente principal del simulador NAT
const NATSimulator = () => {
  // Estados
  const [natTable, setNatTable] = useState([]);
  const [packets, setPackets] = useState([]);
  const [nextPort, setNextPort] = useState(50000);
  const [sourceIP, setSourceIP] = useState('192.168.1.100');
  const [sourcePort, setSourcePort] = useState('3456');
  const [destIP, setDestIP] = useState('8.8.8.8');
  const [destPort, setDestPort] = useState('80');
  const [publicIP] = useState('203.0.113.5');
  const [showInfo, setShowInfo] = useState(true);
  const [responseDelay, setResponseDelay] = useState('5');
  const [autoResponse, setAutoResponse] = useState(true);
  const [errors, setErrors] = useState({});
  const [connectionLost, setConnectionLost] = useState(null);

  const ENTRY_TIMEOUT = 30000; // 30 segundos

  // Funciones de validación
  const isValidIP = (ip) => {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255 && part === num.toString();
    });
  };

  const isValidPort = (port) => {
    const num = parseInt(port, 10);
    return !isNaN(num) && num > 0 && num <= 65535 && port === num.toString();
  };

  const validateOutbound = () => {
    const newErrors = {};
    if (!isValidIP(sourceIP)) {
      newErrors.sourceIP = 'IP inválida (formato: xxx.xxx.xxx.xxx, 0-255)';
    }
    if (!isValidPort(sourcePort)) {
      newErrors.sourcePort = 'Puerto inválido (1-65535)';
    }
    if (!isValidIP(destIP)) {
      newErrors.destIP = 'IP inválida';
    }
    if (!isValidPort(destPort)) {
      newErrors.destPort = 'Puerto inválido (1-65535)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Efecto para manejar expiración de entradas
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNatTable(prev => {
        const updated = prev.map(entry => {
          if (now - entry.createdAt > ENTRY_TIMEOUT && entry.status === 'active') {
            return { ...entry, status: 'expired' };
          }
          return entry;
        });
        return updated.filter(entry =>
          entry.status === 'active' || (now - entry.createdAt < ENTRY_TIMEOUT + 5000)
        );
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Función para enviar paquete saliente
  const sendOutboundPacket = () => {
    if (!validateOutbound()) return;
    setConnectionLost(null);

    const newEntry = {
      id: Date.now(),
      privateIP: sourceIP,
      privatePort: parseInt(sourcePort, 10),
      publicIP: publicIP,
      publicPort: nextPort,
      destIP: destIP,
      destPort: parseInt(destPort, 10),
      timestamp: new Date().toLocaleTimeString(),
      createdAt: Date.now(),
      status: 'active'
    };

    setNatTable([...natTable, newEntry]);

    const outboundPacket = {
      id: Date.now(),
      entryId: newEntry.id,
      type: 'outbound',
      from: `${sourceIP}:${sourcePort}`,
      to: `${destIP}:${destPort}`,
      translated: `${publicIP}:${nextPort}`,
      stage: 0
    };

    setPackets([outboundPacket]);
    setNextPort(nextPort + 1);

    setTimeout(() => {
      setPackets(prev => prev.map(p =>
        p.id === outboundPacket.id ? { ...p, stage: 1 } : p
      ));
    }, 500);

    setTimeout(() => {
      setPackets(prev => prev.map(p =>
        p.id === outboundPacket.id ? { ...p, stage: 2 } : p
      ));
    }, 1000);

    if (autoResponse) {
      const delayMs = parseInt(responseDelay, 10) * 1000;

      setTimeout(() => {
        const entry = natTable.find(e => e.id === newEntry.id);
        const currentEntry = entry || newEntry;

        if (currentEntry.status === 'expired' || Date.now() - currentEntry.createdAt > ENTRY_TIMEOUT) {
          setConnectionLost({
            from: `${currentEntry.destIP}:${currentEntry.destPort}`,
            to: `${currentEntry.publicIP}:${currentEntry.publicPort}`,
            reason: 'La entrada NAT expiró antes de recibir la respuesta'
          });
          return;
        }

        const inboundPacket = {
          id: Date.now(),
          entryId: newEntry.id,
          type: 'inbound',
          from: `${currentEntry.destIP}:${currentEntry.destPort}`,
          to: `${currentEntry.publicIP}:${currentEntry.publicPort}`,
          translated: `${currentEntry.privateIP}:${currentEntry.privatePort}`,
          stage: 0,
          matchedEntry: currentEntry.id
        };

        setPackets(prev => [...prev, inboundPacket]);

        setTimeout(() => {
          setPackets(prev => prev.map(p =>
            p.id === inboundPacket.id ? { ...p, stage: 1 } : p
          ));
        }, 500);

        setTimeout(() => {
          setPackets(prev => prev.map(p =>
            p.id === inboundPacket.id ? { ...p, stage: 2 } : p
          ));
        }, 1000);
      }, delayMs + 1500);
    }
  };

  const clearTable = () => {
    setNatTable([]);
    setPackets([]);
    setNextPort(50000);
    setConnectionLost(null);
  };

  const getRemainingTime = (entry) => {
    const elapsed = Date.now() - entry.createdAt;
    const remaining = Math.max(0, ENTRY_TIMEOUT - elapsed);
    return Math.ceil(remaining / 1000);
  };

  // Renderizado del componente
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Router size={32} />
                <div>
                  <h1 className="text-3xl font-bold">Simulador NAT Completo</h1>
                  <p className="text-blue-100 mt-1">Network Address Translation con Respuestas Automáticas</p>
                </div>
              </div>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <Info size={24} />
              </button>
            </div>
          </div>

          {/* Info Banner */}
          {showInfo && (
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 m-6">
              <h3 className="font-bold text-blue-900 mb-2">¿Cómo funciona?</h3>
              <p className="text-sm text-blue-800 mb-2">
                Este simulador muestra el proceso completo de NAT: el paquete saliente y su respuesta.
                Puedes ajustar el tiempo de respuesta para ver qué sucede cuando una entrada NAT expira
                antes de recibir la respuesta del servidor.
              </p>
              <p className="text-sm text-blue-800">
                <strong>⏱️ Nota:</strong> Las entradas NAT expiran después de 30 segundos. Si la respuesta
                tarda más, la conexión se perderá.
              </p>
            </div>
          )}

          {/* Main Content */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Configuration Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Wifi className="mr-2" size={20} />
                  Configurar Paquete Saliente
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      IP Origen (Privada)
                    </label>
                    <input
                      type="text"
                      value={sourceIP}
                      onChange={(e) => setSourceIP(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.sourceIP ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="192.168.1.100"
                    />
                    {errors.sourceIP && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.sourceIP}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Puerto Origen
                    </label>
                    <input
                      type="text"
                      value={sourcePort}
                      onChange={(e) => setSourcePort(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.sourcePort ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="3456"
                    />
                    {errors.sourcePort && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.sourcePort}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      IP Destino (Servidor)
                    </label>
                    <input
                      type="text"
                      value={destIP}
                      onChange={(e) => setDestIP(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.destIP ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="8.8.8.8"
                    />
                    {errors.destIP && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.destIP}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Puerto Destino
                    </label>
                    <input
                      type="text"
                      value={destPort}
                      onChange={(e) => setDestPort(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.destPort ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="80"
                    />
                    {errors.destPort && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.destPort}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>IP Pública del Router:</strong> {publicIP} | <strong>Próximo puerto público:</strong> {nextPort}
                  </p>
                </div>

                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={20} className="text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Configuración de Respuesta Automática</h4>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoResponse}
                        onChange={(e) => setAutoResponse(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        Generar respuesta automática
                      </span>
                    </label>
                  </div>

                  {autoResponse && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tiempo de respuesta del servidor (segundos)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="range"
                          min="1"
                          max="35"
                          value={responseDelay}
                          onChange={(e) => setResponseDelay(e.target.value)}
                          className="flex-1"
                        />
                        <span className="font-mono font-bold text-lg w-12 text-center">{responseDelay}s</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        {parseInt(responseDelay) > 30
                          ? '⚠️ La respuesta llegará después de que expire la entrada NAT (30s)'
                          : parseInt(responseDelay) > 25
                          ? '⚠️ Tiempo límite - la entrada podría expirar'
                          : '✓ La respuesta llegará antes de la expiración'}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={sendOutboundPacket}
                  className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  Enviar Paquete y Esperar Respuesta
                </button>
              </div>

              {/* Connection Lost Alert */}
              {connectionLost && (
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6 animate-pulse">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={32} className="text-red-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-red-900 mb-2">
                        ⚠️ Conexión Perdida
                      </h3>
                      <p className="text-red-800 mb-2">
                        <strong>Paquete de respuesta:</strong> {connectionLost.from} → {connectionLost.to}
                      </p>
                      <p className="text-red-700 font-semibold">
                        {connectionLost.reason}
                      </p>
                      <p className="text-sm text-red-600 mt-2">
                        El servidor respondió demasiado tarde. La entrada NAT ya no existe en la tabla del router,
                        por lo que el paquete de respuesta no puede ser traducido y se descarta.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Packet Visualization */}
              {packets.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <RefreshCw className="animate-spin" size={20} />
                    Proceso de Comunicación Completo
                  </h3>

                  {packets.map(packet => (
                    <div key={packet.id} className="mb-8 last:mb-0">
                      <div className="mb-2 flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                          packet.type === 'outbound'
                            ? 'bg-blue-500 text-white'
                            : 'bg-green-500 text-white'
                        }`}>
                          {packet.type === 'outbound' ? '→ SOLICITUD' : '← RESPUESTA'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className={`flex-1 transition-all duration-500 ${
                          packet.stage >= 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                        }`}>
                          <div className="bg-white rounded-lg p-4 shadow-md border-2 border-blue-300">
                            <div className="font-mono text-sm">
                              <div className="font-bold text-blue-700 mb-2">
                                {packet.type === 'outbound' ? '🖥️ Red Privada' : '🌐 Internet'}
                              </div>
                              <div className="bg-blue-50 p-2 rounded mb-1">
                                <strong>Origen:</strong> {packet.from}
                              </div>
                              <div className="bg-blue-50 p-2 rounded">
                                <strong>Destino:</strong> {packet.to}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`mx-6 transition-all duration-500 ${
                          packet.stage >= 1 ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-180'
                        }`}>
                          <div className="bg-indigo-600 text-white rounded-lg p-6 shadow-2xl relative">
                            <Router size={40} className="animate-pulse" />
                            <div className="text-xs mt-2 font-bold">ROUTER NAT</div>
                            {packet.stage >= 1 && (
                              <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold animate-bounce">
                                ⚡
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={`flex-1 transition-all duration-500 ${
                          packet.stage >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
                        }`}>
                          <div className="bg-white rounded-lg p-4 shadow-md border-2 border-green-300">
                            <div className="font-mono text-sm">
                              <div className="font-bold text-green-700 mb-2">
                                {packet.type === 'outbound' ? '🌐 Internet' : '🖥️ Red Privada'}
                              </div>
                              <div className="bg-green-50 p-2 rounded mb-1">
                                <strong>Origen:</strong> {packet.type === 'outbound' ? packet.translated : packet.from}
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <strong>Destino:</strong> {packet.type === 'outbound' ? packet.to : packet.translated}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {packet.stage >= 1 && packet.stage < 2 && (
                        <div className="mt-3 text-center">
                          <div className="inline-block bg-purple-600 text-white px-6 py-2 rounded-full font-semibold animate-pulse">
                            {packet.type === 'outbound'
                              ? `🔄 Traduciendo ${packet.from} → ${packet.translated}`
                              : `🔄 Traduciendo ${packet.to} → ${packet.translated}`
                            }
                          </div>
                        </div>
                      )}
                      {packet.stage >= 2 && (
                        <div className="mt-3 text-center">
                          <div className="inline-block bg-green-600 text-white px-6 py-2 rounded-full font-semibold">
                            ✓ {packet.type === 'outbound' ? 'Solicitud enviada' : 'Respuesta recibida'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* NAT Table */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Tabla NAT del Router</h3>
                  <button
                    onClick={clearTable}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                  >
                    <Trash2 size={18} />
                    Limpiar Todo
                  </button>
                </div>

                {natTable.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                    La tabla NAT está vacía. Envía un paquete para ver cómo se registra la traducción.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full bg-white rounded-lg overflow-hidden shadow">
                      <thead className="bg-gray-800 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left">IP Privada</th>
                          <th className="px-4 py-3 text-left">Puerto Privado</th>
                          <th className="px-4 py-3 text-left">IP Pública</th>
                          <th className="px-4 py-3 text-left">Puerto Público</th>
                          <th className="px-4 py-3 text-left">Destino</th>
                          <th className="px-4 py-3 text-left">Estado</th>
                          <th className="px-4 py-3 text-left">Tiempo</th>
                          <th className="px-4 py-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {natTable.map((entry) => {
                          const remaining = getRemainingTime(entry);
                          const isExpiring = remaining <= 10 && entry.status === 'active';

                          return (
                            <tr
                              key={entry.id}
                              className={`transition ${
                                entry.status === 'expired'
                                  ? 'bg-red-50 opacity-60'
                                  : packets.some(p => p.matchedEntry === entry.id)
                                  ? 'bg-yellow-100'
                                  : 'hover:bg-blue-50'
                              }`}
                            >
                              <td className="px-4 py-3 font-mono text-sm">{entry.privateIP}</td>
                              <td className="px-4 py-3 font-mono text-sm">{entry.privatePort}</td>
                              <td className="px-4 py-3 font-mono text-sm">{entry.publicIP}</td>
                              <td className="px-4 py-3 font-mono text-sm">{entry.publicPort}</td>
                              <td className="px-4 py-3 font-mono text-sm">{entry.destIP}:{entry.destPort}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                  entry.status === 'active'
                                    ? isExpiring
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {entry.status === 'active' ? '● Activo' : '○ Expirado'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {entry.status === 'active' ? (
                                  <span className={`flex items-center gap-1 ${isExpiring ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                    <Clock size={14} />
                                    {remaining}s
                                  </span>
                                ) : (
                                  <span className="text-gray-400">---</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => setNatTable(natTable.filter(e => e.id !== entry.id))}
                                  className="text-red-500 hover:text-red-700 transition"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Renderizar el componente en el DOM
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<NATSimulator />);
