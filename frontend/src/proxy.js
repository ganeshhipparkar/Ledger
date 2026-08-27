import { NextResponse } from 'next/server'

export function proxy(request) {
    let hasAccessToken = request.cookies.get('accessToken')?.value;
    const { pathname } = request.nextUrl;

    const publicAuthPages = ['/login', '/forgot-password', '/confirm-otp', '/reset-password'];
    const isPublicAuthPage = publicAuthPages.some(page => pathname === page || pathname.startsWith(page + '/'));

    if (hasAccessToken) {
        if (isPublicAuthPage) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    } else {
        if (!isPublicAuthPage) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    }
}

export const config = {
    matcher: [
        '/login',
        '/forgot-password',
        '/confirm-otp',
        '/reset-password',
        '/contact',
        '/',
        '/users',
        '/user:path*',
        '/reset-pass',
        '/add-company',
        '/company-list',
        '/group-list',
        '/capabilities',
        '/capability:path*',
        '/forbidden',
        '/profile',
        '/currency-list',
        '/currency:path*',
        '/add-currency',
        '/payment-transaction-list',
        '/payment-transaction-add',
        '/payment-transaction:path*'
    ],
}

