import { FastifyInstance, FastifyPluginCallback } from "fastify";
import { ApplicationController } from "./controllers/applications";
import { CompanyApplicationController } from "./controllers/company-applications";

import { applicationEventHookSchema } from "./schemas";

const applicationsUrl = "/applications";
const companyApplicationsUrl = "/companies/:company_id/applications";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, options, next) => {
  const applicationController = new ApplicationController();
  const companyApplicationController = new CompanyApplicationController();

  /**
   * Applications collection
   * Marketplace of applications
   */

  //Get a single application in the marketplace
  fastify.route({
    method: "GET",
    url: `${applicationsUrl}/:application_id`,
    preValidation: fastify.authenticate,
    // schema: applicationGetSchema,
    handler: applicationController.get.bind(applicationController),
  });

  /**
   * Company applications collection
   * Company-wide available applications
   * (must be my company application and I must be company admin)
   */

  //Get list of applications for a company
  fastify.route({
    method: "GET",
    url: `${companyApplicationsUrl}`,
    preValidation: fastify.authenticate,
    handler: companyApplicationController.list.bind(companyApplicationController),
  });

  //Get one application of a company
  fastify.route({
    method: "GET",
    url: `${companyApplicationsUrl}/:application_id`,
    preValidation: fastify.authenticate,
    handler: companyApplicationController.get.bind(companyApplicationController),
  });

  //Application event triggered by a user
  fastify.route({
    method: "POST",
    url: `${applicationsUrl}/:application_id/event`,
    preValidation: fastify.authenticate,
    schema: applicationEventHookSchema,
    handler: applicationController.event.bind(applicationController),
  });

  next();
};

export default routes;
