// OWNER 2: services, wait-time estimation, admin service integration.
import * as v from '../shared/validation.js';
import { fail } from '../shared/errors.js';
export function getService(store, id) {
  const service = store.services.find(s => s.id === id);
  if (!service) fail(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  return service;
}
export function createServices(store) {
  function fields(body, partial = false) {
    v.object(body, ['name', 'description', 'expectedDuration', 'priority', 'isOpen']);
    if (partial && !Object.keys(body).length) fail(400, 'VALIDATION_ERROR', 'Provide at least one field.');
    const output = {};
    for (const [key, validate] of Object.entries({
      name: () => v.text(body, 'name', 1, 100), description: () => v.text(body, 'description', 1, 500),
      expectedDuration: () => v.integer(body, 'expectedDuration', 1, 480),
      priority: () => v.choice(body, 'priority', ['low', 'medium', 'high']), isOpen: () => v.boolean(body, 'isOpen'),
    })) {
      if (!partial && key !== 'isOpen' || Object.hasOwn(body, key)) output[key] = validate();
    }
    return output;
  }
  return {
    list: () => store.services.map(s => ({ ...s })),
    create(body) { const service = { id: store.nextId(), isOpen: true, ...fields(body) }; store.services.push(service); return service; },
    update(id, body) { const service = getService(store, id); Object.assign(service, fields(body, true)); return service; },
  };
}
