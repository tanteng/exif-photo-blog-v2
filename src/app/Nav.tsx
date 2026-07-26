import NavClient from './NavClient';
import { NAV_CAPTION, NAV_TITLE } from './config';

export default async function Nav() {
  return <NavClient
    navTitle={NAV_TITLE}
    navCaption={NAV_CAPTION}
  />;
}
