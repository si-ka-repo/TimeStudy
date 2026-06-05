import { APP_TABS, type AppTabId } from "../config/appTabs";

type AppTabNavProps = {
  activeTab: AppTabId;
  onSelectTab: (tab: AppTabId) => void;
};

export function AppTabNav({ activeTab, onSelectTab }: AppTabNavProps) {
  return (
    <>
      <div className="tabs tabs--header" role="tablist" aria-label="メイン画面">
        {APP_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            className={activeTab === tab.id ? "tab active" : "tab"}
            aria-selected={activeTab === tab.id}
            aria-controls={tab.panelId}
            title={tab.fullLabel}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="tab__short">{tab.shortLabel}</span>
            <span className="tab__full">{tab.fullLabel}</span>
          </button>
        ))}
      </div>

      <nav className="bottom-nav" aria-label="メイン画面（モバイル）">
        {APP_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "bottom-nav__item active" : "bottom-nav__item"}
            aria-current={activeTab === tab.id ? "page" : undefined}
            title={tab.fullLabel}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="bottom-nav__label">{tab.shortLabel}</span>
            <span className="bottom-nav__hint">{tab.id}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
