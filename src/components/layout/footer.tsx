import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="py-12 bg-neutral-900 text-neutral-400">
      <div className="container mx-auto px-8 md:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Logo and Tagline */}
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold mb-2">
                <span className="text-white">Shot</span>
                <span className="text-primary/60">Rio</span>
              </div>
              <p className="text-sm text-neutral-500">{t('footer.tagline')}</p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center items-center gap-6 text-sm">
              <Link 
                href="/pricing" 
                className="hover:text-white transition-colors"
              >
                {t('footer.pricing')}
              </Link>
              <Separator orientation="vertical" className="h-4 bg-neutral-700" />
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

          {/* Beta Notice */}
          <div className="mb-6 flex items-start justify-center gap-2 text-xs text-neutral-500 max-w-3xl mx-auto">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary/60" />
            <p className="text-center leading-relaxed">
              {t('beta.description')}
            </p>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm text-neutral-500">
              © {new Date().getFullYear()} ShotRio. {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
