/// <reference types="node" />
export declare type CoapMethod = "GET" | "POST" | "PUT" | "DELETE" | "FETCH" | "PATCH" | "iPATCH";
export interface Option {
    name: number | string;
    value: Buffer;
}
export declare type OptionName = "If-Match" | "Uri-Host" | "ETag" | "If-None-Match" | "Observe" | "Uri-Port" | "Location-Path" | "Uri-Path" | "Content-Format" | "Max-Age" | "Uri-Query" | "Accept" | "Location-Query" | "Block2" | "Block1" | "Proxy-Uri" | "Proxy-Scheme" | "Size1";
export interface NamedOption {
    name: OptionName;
    value: Buffer;
}
export interface Packet {
    token?: Buffer;
    code?: CoapMethod | string;
    messageId?: number;
    payload?: Buffer;
    options?: (Option | NamedOption)[];
    confirmable?: boolean;
    reset?: boolean;
    ack?: boolean;
}
export interface ParsedPacket {
    code: string;
    confirmable: boolean;
    reset: boolean;
    ack: boolean;
    messageId: number;
    token: Buffer;
    options: (Option | NamedOption)[];
    payload: Buffer;
}
export declare function generate(packet?: Packet): Buffer;
export declare function parse(buffer: Buffer): ParsedPacket;
