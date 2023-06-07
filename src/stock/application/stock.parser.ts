export class StockParser {
    parsePrice(value: string): number {
        return parseInt(value.replace(/,/g, '').replace(/ 원/g, ''))
    }

    parseStock(value: string): number {
        if (value === '품절') {
            return 0
        }
        return parseInt(value.replace(/ 개/g, ''))
    }
}
