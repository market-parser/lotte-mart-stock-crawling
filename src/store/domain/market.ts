import {Area} from "./area";

export class Market {
    constructor(
        readonly area: Area,
        readonly name: string,
        readonly code: string,
    ) {
    }
}
