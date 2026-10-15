export const getDefaultPageSize = () => {
    const raw = process.env.NEXT_PUBLIC_USERS_LIST_LIMIT;
    const parsed = parseInt(raw, 10);
    return !isNaN(parsed) && parsed >= 1 ? parsed : 10;
};

export const DEFAULT_PAGE_SIZE = getDefaultPageSize();

export const BASE_PAGE_SIZE_OPTIONS = [10, 20, 50];

export const PAGE_SIZE_OPTIONS = BASE_PAGE_SIZE_OPTIONS.includes(DEFAULT_PAGE_SIZE)
    ? BASE_PAGE_SIZE_OPTIONS
    : [...BASE_PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE].sort((a, b) => a - b);
