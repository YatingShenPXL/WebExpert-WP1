const { randomUUID } = require("node:crypto");

function createService(config) {
  function fail(status, message) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }


  function findItem(route, id) {
    const items = config[route] || [];

    const item = items.find(item => item.id === id);

    if (!item) {
      fail(404, `ID ${id} doesn't exist in ${route}`);
    }

    return item;
  }

 function embedRelations(item, embed) {
  const result = { ...item };

  if (embed !== "owners") {
    return result;
  }

  const ownerIds = [].concat(item.ownerIds ?? []);
  const persons = config["persons"] || [];

  result.owners = persons
    .filter(person => ownerIds.some(id => String(id) === String(person.id)))
    .map(person => ({ ...person }));

  return result;
}

  function getAll(route, embed) {
    return config[route].map(item =>
      embedRelations(item, embed)
    );
  }

  function getById(route, id, embed) {
    const item = findItem(route, id);
    return embedRelations(item, embed);
  }

  function add(route, body) {
    const items = config[route] || [];

    const record = {
      ...body,
      id: randomUUID(),
    };

    items.push(record);

    return record;
  }

  function update(route, id, body) {
    const currentItem = findItem(route, id);

    Object.assign(currentItem, {
      ...body,
      id: currentItem.id,
    });

    return currentItem;
  }

  function remove(route, id) {
    const items = config[route] || [];
    const item = findItem(route, id);
    items.splice(items.indexOf(item), 1);
  }

  return {
    getAll,
    getById,
    add,
    update,
    remove,
  };
}
module.exports = createService;