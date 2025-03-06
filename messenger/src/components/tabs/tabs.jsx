import { createSignal } from 'solid-js';
import Tab from './tab';
import TabContent from './tabContent';

const Tabs = (props) => {
  const [activeTab, setActiveTab] = createSignal(0);

  return (
    <div class="flex flex-col h-full">
      <div class="flex border-b border-gray-800">
        {props.tabs.map((tab, index) => (
          <Tab
            label={tab.label}
            active={activeTab() === index}
            onClick={() => setActiveTab(index)}
            class={`px-4 py-3 font-medium border-b-2 transition-colors duration-200 ${
              activeTab() === index
                ? props.activeClass || 'text-violet-500 border-violet-500'
                : props.inactiveClass || 'text-gray-400 hover:text-gray-200 border-transparent'
            }`}
          />
        ))}
      </div>
      <div class="flex-1 overflow-y-auto">
        {props.tabs.map((tab, index) => (
          <TabContent active={activeTab() === index}>
            {tab.content}
          </TabContent>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
