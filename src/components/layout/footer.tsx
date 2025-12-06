import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="py-12 bg-neutral-900 text-neutral-400">
      <div className="container mx-auto px-8 md:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Logo and Slogan */}
            <div className="text-center md:text-left">
              <span className="text-3xl font-bold text-white mb-2 block">
                Cineqo
              </span>
              <p className="text-sm text-neutral-500">{t('home.slogan')}</p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center items-center gap-6 text-sm">
              <Link 
                href="/privacy" 
                className="hover:text-white transition-colors"
              >
                {t('footer.privacy')}
              </Link>
              <Separator orientation="vertical" className="h-4 bg-neutral-700" />
              <Link 
                href="/terms" 
                className="hover:text-white transition-colors"
              >
                {t('footer.terms')}
              </Link>
            </div>
          </div>

          <Separator className="my-6 bg-neutral-800" />

          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm text-neutral-500">
              © {new Date().getFullYear()} Cineqo. {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
