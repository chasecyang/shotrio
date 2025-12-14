import { Link } from "@/i18n/routing";
import { AuthButton } from "@/components/auth/auth-button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { getTranslations } from "next-intl/server";

export async function Header() {
  const user = await getCurrentUser();
  const t = await getTranslations("nav");

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Cineqo
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {user && (
            <Button asChild>
              <Link href="/projects" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t("createProject")}</span>
              </Link>
            </Button>
          )}
          <LanguageSwitcher />
          <AuthButton initialUser={user} />
        </div>
      </div>
    </header>
  );
}
