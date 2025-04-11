import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Para base de datos en local

// const db = new pg.Client({
//   user: "postgres",
//   host: "localhost",
//   database: "pruebaClientes",
//   password: "jeferparra",
//   port: 5432,
// });

// db.connect();

// Para base de datos en Neon

const db = new pg.Client({
  connectionString:
    "postgresql://pruebaClientes_owner:npg_LQBvOP0djF1M@ep-sparkling-forest-a5adx2v9-pooler.us-east-2.aws.neon.tech/pruebaClientes?sslmode=require",
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect()
  .then(() => console.log("Conexión exitosa a Neon"))
  .catch((err) => console.error("Error de conexión", err));

let clientes = [];
let rutas = [];
let vehiculos = [];
let productos = [];
let ventas = [];

getData();

async function getData() {
  const resultRutas = await db.query("SELECT * FROM rutas");
  const resultVehiculos = await db.query("SELECT * FROM vehiculos");
  const resultProductos = await db.query("SELECT * FROM productos");
  // Llamar productos de la base de datos

  rutas = resultRutas.rows;
  vehiculos = resultVehiculos.rows;
  productos = resultProductos.rows;
}

// Inicio

app.get("/", (req, res) => {
  res.render("index.ejs");
});

// Cliente Nuevo - Agregar Cliente

app.get("/clienteNuevo", (req, res) => {
  res.render("clienteNuevo.ejs", {
    vehiculos,
    rutas,
  });
});

app.post("/add", async (req, res) => {
  const codigo = req.body.codigo;
  const nombre = req.body.nombre;
  const direccion = req.body.direccion;
  const barrio = req.body.barrio;
  const telefono = req.body.telefono;
  const descripcion = req.body.descripcion;
  const vehiculo = req.body.vehiculo;
  const ruta = req.body.ruta;

  await db.query(
    `INSERT INTO clientes 
    (codigo, nombre, direccion, barrio, telefono, descripcion, vehiculo, ruta, estado)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8,'Activo')`,
    [codigo, nombre, direccion, barrio, telefono, descripcion, vehiculo, ruta]
  );

  res.redirect("/clienteNuevo");
});

// buscar clientes

app.get("/buscarClientes", (req, res) => {
  res.render("buscarClientes.ejs", {
    vehiculos: vehiculos,
    rutas: rutas,
    clientes: [],
  });
});

app.post("/buscar-filtrado-clientes", async (req, res) => {
  const buscarEn = req.body.buscarEn;
  const buscarPor = req.body.buscarPor;
  const vehiculo = req.body.vehiculo;
  const ruta = req.body.ruta;
  const buscar = req.body.buscar;

  let query = "SELECT * FROM clientes WHERE 1=1";
  let condiciones = [];

  if (buscarEn !== "todos") {
    query += ` AND estado = $${condiciones.length + 1}`;
    condiciones.push(buscarEn);
  }

  if (buscarPor !== "todos") {
    if (buscarPor === "codigo") {
      query += ` AND codigo = $${condiciones.length + 1}`;
      condiciones.push(buscar);
    } else if (buscarPor === "barrio") {
      query += ` AND barrio ILIKE '%' || $${condiciones.length + 1} || '%'`;
      condiciones.push(buscar);
    } else if (buscarPor === "nombre") {
      query += ` AND nombre ILIKE '%' || $${condiciones.length + 1} || '%'`;
      condiciones.push(buscar);
    } else if (buscarPor === "vehiculo-ruta") {
      if (vehiculo !== "todos" && ruta !== "todos") {
        query += ` AND vehiculo = $${condiciones.length + 1}`;
        condiciones.push(vehiculo);

        query += ` AND ruta = $${condiciones.length + 1}`;
        condiciones.push(ruta);
      } else if (vehiculo !== "todos") {
        query += ` AND vehiculo = $${condiciones.length + 1}`;
        condiciones.push(vehiculo);
      } else if (ruta !== "todos") {
        query += ` AND ruta = $${condiciones.length + 1}`;
        condiciones.push(ruta);
      }
    }
  }

  try {
    const result = await db.query(
      `${query} ORDER BY cliente_id ASC`,
      condiciones
    );
    clientes = result.rows;

    res.render("buscarClientes.ejs", {
      vehiculos,
      rutas,
      clientes,
    });
  } catch (error) {
    console.error("Error al realizar la consulta: ", error);
  }
});

// Editar cliente en buscar cliente

app.post("/editar-cliente", async (req, res) => {
  const {
    codigo,
    nombre,
    direccion,
    barrio,
    telefono,
    descripcion,
    vehiculo,
    ruta,
    estado,
  } = req.body;

  try {
    const query = `
      UPDATE clientes
      SET
        nombre = $1,
        direccion = $2,
        barrio = $3,
        telefono = $4,
        descripcion = $5,
        vehiculo = $6,
        ruta = $7,
        estado = $8
      WHERE codigo = $9
      RETURNING *;
    `;

    const values = [
      nombre,
      direccion,
      barrio,
      telefono,
      descripcion,
      vehiculo,
      ruta,
      estado,
      codigo,
    ];

    const result = await db.query(query, values);

    const clienteActualizado = result.rows[0];

    const actualizarCambio = clientes.map((cliente) => {
      if (cliente.codigo === clienteActualizado.codigo) {
        return clienteActualizado;
      }
      return cliente;
    });

    clientes = actualizarCambio;

    res.render("buscarClientes.ejs", {
      vehiculos,
      rutas,
      clientes,
    });
  } catch (error) {
    console.error(error);
  }
});

// Historial Cliente

app.get("/historialCliente", (req, res) => {
  ventas = [];

  res.render("historialCliente.ejs", {
    ventas,
    mostrarTabla: false,
    infoCliente: null,
    mostrarCliente: null,
    mensaje: null,
  });
});

app.post("/historial-cliente", async (req, res) => {
  const codigo = req.body.codigo;

  if (!codigo || codigo.trim() === "") {
    return res.render("historialCliente.ejs", {
      ventas: [],
      mostrarTabla: false,
      infoCliente: null,
      mostrarCliente: null,
      mensaje: "El campo de código no puede estar vacío.",
    });
  }

  try {
    const result = await db.query(
      "SELECT * FROM ventas WHERE codigo = $1 ORDER BY fecha ASC",
      [codigo]
    );
    const dataCliente = await db.query(
      "SELECT * FROM clientes WHERE codigo = $1",
      [codigo]
    );

    ventas = result.rows;
    let mensaje = "";
    const infoCliente =
      dataCliente.rows.length > 0 ? dataCliente.rows[0] : null;

    if (!infoCliente) {
      mensaje = `El cliente con el codigo ${codigo} no existe en la base de datos.`;
    } else if (ventas.length === 0) {
      mensaje = `El cliente con el codigo ${codigo} no ha realizado compras aun.`;
    }

    res.render("historialCliente.ejs", {
      ventas,
      mostrarTabla: ventas.length > 0,
      mostrarCliente: infoCliente !== null,
      infoCliente,
      mensaje,
    });
  } catch (error) {
    console.error(`Error en la consulta: `, error);

    res.render("historialCliente.ejs", {
      ventas: [],
      mostrarTabla: false,
      infoCliente: null,
    });
  }
});

// Cargar Planilla

app.get("/cargarPlanilla", (req, res) => {
  let fecha = "";
  let vehiculoSeleccionado = "";
  let rutaSeleccionada = "";
  let productoSeleccionado = "";

  let ultimaVenta = {
    fecha: "",
    vehiculo: "",
    ruta: "",
    codigo: "",
    producto: {
      nombre: "",
      precio: "",
    },
    cantidad: "",
    contado: "",
    credito: "",
    pago: "",
    abono: "",
    saldo: "",
    botellones: "",
    formaDePago: "",
  };

  res.render("cargarPlanilla.ejs", {
    fecha,
    vehiculoSeleccionado,
    rutaSeleccionada,
    productoSeleccionado,
    ultimaVenta,
    vehiculos,
    rutas,
    clientes,
    productos,
  });
});

app.post("/cargar-venta", async (req, res) => {
  const fecha = req.body.fecha;
  const vehiculo = req.body.vehiculo;
  const ruta = req.body.ruta;
  const codigo = Number(req.body.codigo);
  const producto = req.body.producto;
  const valor = productos.find(
    (elemento) => elemento.nombre === producto
  )?.valor;
  const cantidad = req.body.cantidad;
  const pago = req.body.pago;
  const botellones = req.body.botellones;
  const formaDePago = req.body.formaDePago;

  const resultClientes = await db.query("SELECT * FROM clientes");
  clientes = resultClientes.rows;
  const clienteEncontrado = clientes.find(
    (cliente) => cliente.codigo === codigo
  );

  if (!clienteEncontrado) {
    console.log(
      "El cliente no existe en la base de datos o ingresaste un valor no valido."
    );
    return res.status(400).send("Error: El cliente no existe o no es valido.");
  }

  if (isNaN(valor) || isNaN(pago)) {
    console.log("Valor o pago no son números válidos");
    return res.status(400).send("Error: Valor o pago no válidos");
  }

  const compra = valor * cantidad;
  let contado = 0;
  let credito = 0;
  let abono = 0;
  let saldo = clienteEncontrado.saldo;
  let botellonesCliente =
    Number(clienteEncontrado.botellones) + Number(botellones);

  if (pago <= compra && saldo === 0) {
    contado = pago;
    credito = compra - contado;
    saldo = credito;
    console.log("opcion 1");
  } else if (compra + saldo === pago) {
    abono = saldo;
    contado = compra;
    console.log("opcion 2");
  } else if (!pago || pago === 0) {
    credito = compra;
    saldo = saldo + credito;
    console.log("opcion 3");
  } else if (pago >= compra && pago > saldo && compra + saldo > pago) {
    credito = compra + saldo - pago;
    contado = compra - credito;
    abono = pago - contado;
    saldo = credito;
    console.log("opcion 4");
  } else if (pago < saldo) {
    credito = compra;
    abono = pago;
    saldo = saldo + compra - pago;
    console.log("opcion 5");
  } else if (pago > saldo + compra) {
    console.log("Se esta pagando mas de lo que debe");
    return res.status(400).send("Error: Se está pagando más de lo que debe");
  } else {
    console.log("No esta dentro de las opciones");
  }

  let ultimaVenta = {
    fecha: fecha,
    vehiculo: vehiculo,
    ruta: ruta,
    codigo: codigo,
    producto: {
      nombre: producto,
      precio: valor,
    },
    cantidad: cantidad,
    contado: contado,
    credito: credito,
    pago: pago,
    abono: abono,
    saldo: saldo,
    botellones: botellones,
    total_botellones: botellonesCliente,
    formaDePago: formaDePago,
  };

  try {
    // actualizar saldo y cantidad de botellones prestados en la base de datos del cliente
    await db.query("UPDATE clientes SET saldo = $1 WHERE codigo = $2", [
      saldo,
      codigo,
    ]);
    await db.query("UPDATE clientes SET botellones = $1 WHERE codigo = $2", [
      botellonesCliente,
      codigo,
    ]);

    // cargar datos de la venta
    await db.query(
      `
      INSERT INTO ventas 
      (codigo, producto, valor, cantidad, contado, credito, abono, saldo, botellones, forma_de_pago, fecha, vehiculo, ruta, prestado_recuperado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `,
      [
        codigo,
        producto,
        valor,
        cantidad,
        contado,
        credito,
        abono,
        saldo,
        botellonesCliente,
        formaDePago,
        fecha,
        vehiculo,
        ruta,
        botellones,
      ]
    );

    res.render("cargarPlanilla.ejs", {
      fecha,
      vehiculoSeleccionado: vehiculo,
      rutaSeleccionada: ruta,
      productoSeleccionado: producto,
      ultimaVenta,
      vehiculos,
      rutas,
      clientes,
      productos,
    });
  } catch (error) {
    console.error("Error al cargar la venta");
  }
});

// Ver planilla

app.get("/verPlanilla", (req, res) => {
  let fecha = "";
  let vehiculoSeleccionado = "";
  let rutaSeleccionada = "";
  let buscando = false;
  ventas = []; // para asegurarme que ventas esta vacio

  let productos = [];
  let contado = 0;
  let credito = 0;
  let abono = 0;
  let prestados = 0;
  let recuperados = 0;

  res.render("verPlanilla.ejs", {
    fecha,
    vehiculoSeleccionado,
    rutaSeleccionada,
    vehiculos,
    rutas,
    ventas,
    buscando,
    productos,
    contado,
    credito,
    abono,
    prestados,
    recuperados,
  });
});

app.post("/ver-planilla-encontrada", async (req, res) => {
  const fecha = req.body.fecha;
  const vehiculo = req.body.vehiculo;
  const ruta = req.body.ruta;
  let buscando = true;

  let productos = [];
  let contado = 0;
  let credito = 0;
  let abono = 0;
  let prestados = 0;
  let recuperados = 0;

  try {
    const result = await db.query(
      "SELECT * FROM ventas WHERE fecha = $1 AND vehiculo = $2 AND ruta = $3",
      [fecha, vehiculo, ruta]
    );

    ventas = result.rows;

    // Creando lista de productos vendidos con sus cantidades

    let productosEncontrados = {};

    ventas.forEach((venta) => {
      productos.push([venta.producto, venta.cantidad]);
    });

    productos.forEach(([producto, cantidad]) => {
      if (productosEncontrados[producto]) {
        productosEncontrados[producto] += cantidad;
      } else {
        productosEncontrados[producto] = cantidad;
      }
    });

    productos = Object.entries(productosEncontrados);

    // Calculo de los contados, creditos, abonos, prestados y recuperados

    ventas.forEach((venta) => {
      contado += venta.contado;
      credito += venta.credito;
      abono += venta.abono;

      if (venta.prestado_recuperado > 0) {
        prestados += venta.prestado_recuperado;
      } else if (venta.prestado_recuperado < 0) {
        recuperados += Math.abs(venta.prestado_recuperado);
      }
    });

    res.render("verPlanilla.ejs", {
      fecha,
      vehiculoSeleccionado: vehiculo,
      rutaSeleccionada: ruta,
      vehiculos,
      rutas,
      ventas,
      buscando,
      productos,
      contado,
      credito,
      abono,
      prestados,
      recuperados,
    });
  } catch (error) {
    console.error("Error al cargar la planilla: ", error);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
