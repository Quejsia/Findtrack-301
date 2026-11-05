import React, { useState, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [showToast, setShowToast] = useState(false);

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文' },
    { code: 'fil', name: 'Filipino', nativeName: 'Filipino' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' }
  ];

  const handleLanguageChange = (langCode: string) => {
    if (i18n.language === langCode) return;
    
    setShowToast(true);
    // Add artificial small delay to show the feedback, then switch
    setTimeout(() => {
      i18n.changeLanguage(langCode);
      setTimeout(() => setShowToast(false), 800);
    }, 500);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background h-full overflow-y-auto">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-surface-container-highest border border-outline-variant/30 text-on-surface px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 whitespace-nowrap">
            <div className="h-4 w-4 min-h-4 min-w-4 shrink-0 aspect-square border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="font-label-md text-sm">{t('settings.language.changing')}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-8 border-b border-outline-variant/20 bg-surface">
        <h1 className="font-headline-md text-2xl text-on-surface">{t('settings.title')}</h1>
      </div>

      {/* Content */}
      <div className="p-6 max-w-3xl space-y-8">
        
        {/* Language Section */}
        <section className="bg-surface rounded-xl border border-outline-variant/30 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-outline-variant/20 bg-surface-container-lowest flex items-start gap-4">
            <div className="p-2.5 bg-tertiary-container/30 rounded-xl text-tertiary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-headline-md text-lg text-on-surface">{t('settings.language.title')}</h3>
              <p className="font-body-md text-on-surface-variant/80 mt-1">{t('settings.language.description')}</p>
            </div>
          </div>
          
          <div className="p-2">
            {languages.map((lang) => {
              const isSelected = i18n.language === lang.code || i18n.language.startsWith(`${lang.code}-`);
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${
                    isSelected 
                      ? 'bg-primary-container/20 text-on-surface' 
                      : 'hover:bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className={`font-label-md text-sm ${isSelected ? 'font-bold text-primary' : ''}`}>
                      {lang.nativeName}
                    </span>
                    <span className="font-body-md text-xs opacity-70">{lang.name}</span>
                  </div>
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <Check className="h-3.5 w-3.5 text-on-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Future settings sections can go here */}

      </div>
    </div>
  );
};

export default SettingsPage;
