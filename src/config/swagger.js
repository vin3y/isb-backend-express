// swagger.js
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ISB Admin Backend API',
      version: '1.0.0',
      description: 'API documentation for ISB Admin Backend',
    },
    servers: [
      {
        url: 'http://localhost:8080/api', // local dev
      },
      {
        url: 'http://isb-admin-prod.eba-5darypkj.eu-north-1.elasticbeanstalk.com/api', // EB prod
      },
    ],
  },
  apis: ['./src/routes/*.js'], // annotate routes with swagger comments
};

const swaggerSpec = swaggerJsDoc(options);

module.exports = { swaggerUi, swaggerSpec };
