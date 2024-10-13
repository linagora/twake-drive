/* eslint-disable react/prop-types */
/* eslint-disable react/jsx-key */
import { Component } from 'react';

import { getFilesTree } from '@components/uploads/file-tree-utils';
import Collections from '@deprecated/CollectionsV1/Collections/Collections.js';
import popupManager from '@deprecated/popupManager/popupManager.js';
import currentUserService from '@deprecated/user/CurrentUser';
import LoginService from '@features/auth/login-service';
import InitService from '@features/global/services/init-service';
import Languages from '@features/global/services/languages-service';
import userService from '@features/users/services/current-user-service';
import { ExternalLinkIcon } from '@heroicons/react/outline';
import ButtonWithTimeout from 'components/buttons/button-with-timeout.jsx';
import Input from 'components/inputs/input.jsx';
import MenuList from 'components/menus/menu-component.jsx';
import Attribute from 'components/parameters/attribute.tsx';
import { Button } from '../../../../atoms/button/button';
import * as Text from '../../../../atoms/text';
import './UserParameter.scss';
import { CopyLinkButton } from '../../body/drive/modals/public-link/copy-link-button';


const Page = {
  Account: {
    num: 1,
    title: 'scenes.apps.account.title',
  },
  WebDAV: {
    num: 2,
    title: 'scenes.apps.account-webdav.title',
  },
};

export default class UserParameter extends Component {
  constructor(props) {
    super(props);
    var user = Collections.get('users').find(userService.getCurrentUserId());
    this.state = {
      login: LoginService,
      i18n: Languages,
      users_repository: Collections.get('users'),
      currentUserService: currentUserService,
      page: popupManager.popupStates['user_parameters'] || props.defaultPage || 1,
      attributeOpen: 0,
      subMenuOpened: 0,
      username: user ? user.username : '',
      last_name: user ? user.last_name : '',
      first_name: user ? user.first_name : '',
      thumbnail: false,
      companyId: props.companyId,
    };
    Collections.get('users').addListener(this);
    Collections.get('users').listenOnly(this, [
      Collections.get('users').find(userService.getCurrentUserId()).front_id,
    ]);
    LoginService.addListener(this);
    Languages.addListener(this);
    currentUserService.addListener(this);
  }
  UNSAFE_componentWillMount() {
    this.setState({ thumbnail: false });
  }
  componentWillUnmount() {
    LoginService.removeListener(this);
    Languages.removeListener(this);
    currentUserService.removeListener(this);
    Collections.get('users').removeListener(this);
  }
  open() {
    this.fileinput.click();
  }

  displayScene() {
    if (this.state.page === Page.Account.num) {
      return (
        <form className="" autoComplete="off">
          <div className="title">{this.state.i18n.t(Page.Account.title)}</div>
              <div className="group_section">
                <Attribute
                  label={this.state.i18n.t('scenes.apps.account.languages.menu_title')}
                  description={this.state.i18n.t('scenes.apps.account.languages.text')}
                >
                  <div className="parameters_form">
                    <select
                      className="bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                      value={this.state.i18n.language}
                      onChange={ev => currentUserService.updateLanguage(ev.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="ru">Русский</option>
                    </select>
                  </div>
                </Attribute>
              </div>
        </form>
      );
    } else if (this.state.page === Page.WebDAV.num) {
      return (
        <form className="" autoComplete="off">
          <div className="title">{this.state.i18n.t(Page.WebDAV.title)}</div>
          <div className="group_section">
            <CopyLinkButton
              textToCopy={false}
              onGetTextToCopy={async () => {
                const result = await currentUserService.ensureDeviceKind(this.state.companyId, "WebDAV");
                return `${document.location.protocol}//${encodeURIComponent(result.id)}:${encodeURIComponent(result.password)}@${document.location.host}/internal/services/webdav/v1/webdav/My%20Drive`;
              }}
            />
          </div>
        </form>
      );

    }
  }

  setPage(page) {
    popupManager.popupStates['user_parameters'] = page;
    this.setState({ page: page });
  }

  makeMenuPageEntry(page) {
    return {
      type: 'menu',
      text: this.state.i18n.t(page.title),
      selected: this.state.page === page.num ? 'selected' : '',
      onClick: () => {
        this.setPage(page.num);
      },
    };
  }

  render() {
    return (
      <div className="userParameter fade_in bg-zinc-100 dark:bg-zinc-800 dark:text-white">
        <div className="main">
          <div className="sideBar">
            <MenuList
              menu={[
                this.makeMenuPageEntry(Page.Account),
                this.makeMenuPageEntry(Page.WebDAV),
              ]}
            />
          </div>
          <div className="content">{this.displayScene()}</div>
        </div>
      </div>
    );
  }
}
