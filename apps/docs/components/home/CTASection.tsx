import Link from 'next/link'
import { cn } from '@/lib/cn'
import { GitHubIcon } from './icons'
import { backgrounds, buttonStyles, sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function CTASection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.cta ?? homeTranslations.en.cta

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.cta)} />

      <div className="max-w-4xl mx-auto text-center">
        <h2 className={cn(sectionStyles.title, 'mb-3 sm:mb-4')}>{t.title}</h2>
        <p className={cn(sectionStyles.subtitle, 'mb-6 sm:mb-10')}>{t.subtitle}</p>

        <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
          <Link href={`/${locale}/playground`} className={cn(...buttonStyles.primaryLarge)}>
            {t.playground}
          </Link>
          <a
            href="https://github.com/konoe-akitoshi/shumoku"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(...buttonStyles.secondaryLarge)}
          >
            <GitHubIcon className="w-5 h-5" />
            GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
