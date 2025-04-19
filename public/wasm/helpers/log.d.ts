/**
 * Web-IFC Logging Helper
 * @module Logging
 */
export declare enum LogLevel {
    LOG_LEVEL_DEBUG = 1,
    LOG_LEVEL_WARN = 3,
    LOG_LEVEL_ERROR = 4,
    LOG_LEVEL_OFF = 6
}
export declare abstract class Log {
    private static logLevel;
    static setLogLevel(level: number): void;
    static log(msg: string, ...args: any[]): void;
    static debug(msg: string, ...args: any[]): void;
    static warn(msg: string, ...args: any[]): void;
    static error(msg: string, ...args: any[]): void;
}
