'use strict';

/**
 * Arma la respuesta estándar de los listados paginados.
 */
function paginar({ items, total, page, limit }) {
  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

function offset(page, limit) {
  return (page - 1) * limit;
}

module.exports = { paginar, offset };
