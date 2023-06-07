export function isEmptyOrNull(obj: any[] | string | null) {
    if (Array.isArray(obj)) {
        return obj.length === 0
    }
    if (typeof obj === 'string') {
        return obj === ''
    }
    return obj === null
}
