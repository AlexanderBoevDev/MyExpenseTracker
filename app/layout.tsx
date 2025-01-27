import { Inter } from "next/font/google";
import { Providers } from "@/app/providers";
import NavBar from "@/app/components/NavBar";
import "@/styles/globals.css";
import { FooterPage } from "@/app/components/PageFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Менеджер учета расходов и доходов",
  description: "Менеджер учета расходов и доходов"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`h-full flex flex-col ${inter.className}`}>
        <Providers>
          <div className="dark:text-gray-100 dark:bg-black">
            <NavBar />
            <main className="container flex-grow mx-auto mt-5 mb-5 min-h-screen">
              {children}
            </main>
            <FooterPage />
          </div>
        </Providers>
      </body>
    </html>
  );
}
