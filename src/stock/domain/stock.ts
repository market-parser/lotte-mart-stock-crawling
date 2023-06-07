import {Market} from "../../store/domain/market";

export class Stock {
    constructor(
        readonly market: Market,
        readonly name: string,
        readonly manufacturer: string,
        readonly unit: string,
        readonly price: number,
        readonly stock: number,
    ) {
    }
}
