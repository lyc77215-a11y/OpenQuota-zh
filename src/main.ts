import { mount } from 'svelte';
import App from './App.svelte';
import { installSimplifiedChineseUi, localizeCurrentDocument } from './lib/zhCN';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

const target = document.getElementById('app');

if (!target) {
  throw new Error('OpenQuota mount point was not found');
}

installSimplifiedChineseUi();
mount(App, { target });
localizeCurrentDocument();
