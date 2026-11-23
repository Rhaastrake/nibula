// The PHP backend of a new project, served by PHP's built-in server
// (needs php and composer: skipped locally when missing, required in CI)

const { backendSuite } = require('../helpers/backend-suite');
const { requireTools } = require('../helpers/env');

backendSuite('php', { skip: requireTools('php', 'composer') });
