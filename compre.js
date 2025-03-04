app.post('/cargar-venta', (req, res) => {
  const fecha = req.body.fecha;
  const vehiculo = req.body.vehiculo;
  const ruta = req.body.ruta;
  const codigo = req.body.codigo;
  const producto = req.body.producto;
  const valor = productos.find(elemento => elemento.nombre === producto)?.valor;
  const cantidad = req.body.cantidad;
  const pago = req.body.pago;
  const botellones = req.body.botellones;

  // Verificar que 'valor' y 'pago' sean números válidos
  if (isNaN(valor) || isNaN(pago)) {
    console.log('Valor o pago no son números válidos');
    return res.status(400).send('Error: Valor o pago no válidos');
  }

  const compra = valor * cantidad;
  let contado = 0;
  let credito = 0;
  let abono = 0;
  let saldo = 0;

  // Comprobaciones y asignaciones
  if (pago <= compra && saldo === 0) {
    // El pago cubre la compra, sin saldo previo
    contado = pago;
    credito = compra - contado;
    saldo = credito;
  } else if ((compra + saldo) === pago) {
    // Pago cubre la compra más saldo anterior
    abono = saldo;
    contado = compra;
  } else if (!pago || pago === 0) {
    // No hay pago, el saldo sigue creciendo
    credito = compra;
    saldo = saldo + credito;
  } else if (pago > compra && pago > saldo && (compra + saldo) > pago) {
    // Pago es mayor que la compra + saldo
    credito = compra + saldo - pago;
    contado = compra - credito;
    abono = pago - contado;
    saldo = credito;
  } else if (pago < saldo) {
    // Pago es menor que el saldo
    credito = compra;
    abono = pago;
    saldo = saldo + compra - pago;
  } else {
    // Si ninguna de las condiciones anteriores se cumple
    console.log('Error: No se cumplen las condiciones para la asignación');
  }

  // Crear el objeto `ultimaVenta` con los valores calculados
  let ultimaVenta = {
    fecha: fecha,
    vehiculo: vehiculo,
    ruta: ruta,
    codigo: codigo,
    producto: {
      nombre: producto,
      precio: valor
    },
    cantidad: cantidad,
    contado: contado,
    credito: credito,
    pago: pago,
    abono: abono,
    saldo: saldo,
    botellones: botellones,
    formaDePago: 'Efectivo'
  };

  // Imprimir el objeto para depuración
  console.log(ultimaVenta);

  // Renderizar la vista con los valores
  res.render('cargarPlanilla.ejs', {
    ultimaVenta,
    vehiculos,
    rutas,
    clientes
  });
});
