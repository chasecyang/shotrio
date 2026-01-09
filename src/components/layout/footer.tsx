import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="py-12 bg-muted border-t border-border">
      <div className="container mx-auto px-8 md:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Logo and Tagline */}
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold font-heading mb-2">
                <span className="text-foreground">Shot</span>
                <span className="text-primary/60">Rio</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('footer.tagline')}</p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="/pricing"
                className="hover:text-foreground transition-colors"
              >
                {t('footer.pricing')}
              </Link>
              <Separator orientation="vertical" className="h-4 bg-border" />
              <Link
                href="/changelog"
                className="hover:text-foreground transition-colors"
              >
                {t('footer.changelog')}
              </Link>
              <Separator orientation="vertical" className="h-4 bg-border" />
              <Link
                href="/privacy"
                className="hover:text-foreground transition-colors"
              >
                {t('footer.privacy')}
              </Link>
              <Separator orientation="vertical" className="h-4 bg-border" />
              <Link
                href="/terms"
                className="hover:text-foreground transition-colors"
              >
                {t('footer.terms')}
              </Link>
            </div>
          </div>

          <Separator className="my-6 bg-border" />

          {/* Beta Notice */}
          <div className="mb-6 flex items-start justify-center gap-2 text-xs text-muted-foreground max-w-3xl mx-auto">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary/60" />
            <p className="text-center leading-relaxed">
              {t('beta.description')}
            </p>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ShotRio. {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
