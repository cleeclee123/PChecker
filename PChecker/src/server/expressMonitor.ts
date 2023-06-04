import { Application } from "express";
import expressStatusMonitor from "express-status-monitor";
import { createLogger, transports, format } from "winston";

export class StatusMonitor {
  public logger_ = createLogger({
    transports: [new transports.Console()],
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level}: ${message}`;
      })
    ),
  });

  public mount(_express: Application, port: number): Application {
    this.logger_.info("Booting the 'StatusMonitor' middleware...");

    // Define your status monitor config
    const monitorOptions: object = {
      title: "PChecker API Dashboard",
      theme: "default.css",
      path: "/status",
      spans: [
        {
          interval: 1, // Every second
          retention: 60, // Keep 60 data-points in memory
        },
        {
          interval: 5,
          retention: 60,
        },
        {
          interval: 15,
          retention: 60,
        },
      ],
      chartVisibility: {
        mem: true,
        rps: true,
        cpu: true,
        load: true,
        statusCodes: true,
        responseTime: true,
      },
      healthChecks: [
        {
          protocol: "http",
          host: "localhost",
          path: "/admin/health/ex1",
          port: "3000",
        },
        {
          protocol: "http",
          host: "localhost",
          path: "/admin/health/ex2",
          port: "3000",
        },
      ],
      ignoreStartsWith: '/admin'
    };

    // Loads the express status monitor middleware
    _express.use(expressStatusMonitor(monitorOptions));

    return _express;
  }
}
