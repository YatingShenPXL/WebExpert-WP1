const express = require("express");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const createService = require("./service");

const app = express();
const PORT = 3000;

const CONFIG = process.argv[2] || "config.yaml";
const configPath = path.resolve(__dirname, CONFIG);

let config;

try {
  config = yaml.load(fs.readFileSync(configPath, "utf8"));

  if (!config || !Array.isArray(config.routes)) {
    throw new Error("Config must contain a routes array");
  }
} catch (error) {
  console.error("Error reading or parsing config:", error);
  process.exit(1);
}

const service = createService(config);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); //HTML <form> request
app.set('view engine','hbs');

app.get("/", (req, res) => {
  res.render("index",{
    routes: config.routes
  });
});

app.get("/:route", (req, res) => {
  const route = req.params.route;
  const items = service.getAll(route, req.query.embed);

  res.render("list", {
    items,
    route
  })
});

app.get("/:route/add", (req, res) => {
  const route = req.params.route;
  const isPets = route === "pets";

  res.render("add", {
    route,
    isPets,
    persons: isPets ? service.getAll("persons") : []
  });
});

app.get("/:route/:id", (req, res) => {
  const item = service.getById(
    req.params.route,
    req.params.id,
    req.query.embed
  );

  res.json(item);
});


app.post("/:route", (req, res) => {
  const record = service.add(
    req.params.route,
    req.body
  );

  res.status(201).json(record);
});


app.put("/:route/:id", (req, res) => {
  const record = service.update(
    req.params.route,
    req.params.id,
    req.body
  );

  res.json(record);
});

app.delete("/:route/:id", (req, res) => {
  service.remove(
    req.params.route,
    req.params.id
  );

  res.status(204).send();
});

// Foutafhandeling moet na de routes staan.
app.use((error, req, res, next) => {
  const status = error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error: status >= 500
      ? "Internal server error"
      : error.message,
  });
});

function saveConfig() {
  fs.writeFileSync(
    configPath,
    yaml.dump(config),
    "utf8"
  );
}

const server = app
  .listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  })
  .on("error", error => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log("Shutting down...");

  server.close(() => {
    try {
      saveConfig();
      console.log("Config saved");
      process.exit(0);
    } catch (error) {
      console.error("Error saving config:", error);
      process.exit(1);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);