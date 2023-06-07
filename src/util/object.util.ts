export function isInvalidValue(obj: any[] | string | null | undefined) {
    if (Array.isArray(obj)) {
        return obj.length === 0
    }
    if (typeof obj === 'string') {
        return obj === ''
    }
    return obj === null || obj === undefined
}
