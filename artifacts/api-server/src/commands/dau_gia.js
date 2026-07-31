'use strict';
require('./dau_gia/handler');
const { processExpired } = require('./dau_gia/expired');
module.exports = { processExpired };
