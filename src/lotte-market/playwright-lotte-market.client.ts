import {Browser, Page} from "playwright";
import querystring, {ParsedUrlQueryInput} from "querystring";
import {logger} from "../util/logger.util";

export class PlaywrightLotteMarketClient {
    constructor(private readonly baseUrl: string, private readonly browser: Browser) {
    }

    async get<T>(path: string, query: ParsedUrlQueryInput | null = null, parseFunction: (page: Page) => Promise<T>): Promise<T> {
        let page = await this.browser.newPage();
        try {
            logger.debug(`getting ${path} with query ${JSON.stringify(query)}`)
            const response = await page.goto(this.buildUrl(path, query), {timeout: 0})
            if (response === null || response.status() !== 200) {
                throw new Error(`error occurred while getting ${path} with query ${JSON.stringify(query)}`)
            }
            return await parseFunction(page)
        } catch (exception) {
            logger.error(`error occurred while getting ${path} with query ${JSON.stringify(query)}`)
            throw exception
        } finally {
            await page.close()
        }
    }

    /**
     * API 호출 URL을 생성한다. querystring이 없는 경우에는 URL 생성시 생략한다.
     * @param path API 호출 path
     * @param query API 호출 query
     * @private
     */
    private buildUrl(path: string, query: ParsedUrlQueryInput | null): string {
        if (query === null) {
            return `${this.baseUrl}/${path}`
        }

        const queryString = querystring.stringify(query)
        return `${this.baseUrl}/${path}?${queryString}`
    }
}
