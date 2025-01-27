import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Этот middleware защищает некоторые роуты (см. matcher ниже)
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Если нет токена => пользователь не авторизован => редиректим на /login
  if (!token) {
    // URL-адрес, на который редиректим
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Иначе пропускаем запрос дальше
  return NextResponse.next();
}

// Указываем, какие роуты защищать
export const config = {
  matcher: ["/user/:path*", "/profile", "/dashboard/:path*"]
  // Например, всё под /user/*, /dashboard/*, /profile
};
