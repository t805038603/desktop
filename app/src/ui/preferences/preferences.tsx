import * as React from 'react'
import { Account } from '../../models/account'
import { PreferencesTab } from '../../models/preferences'
import { ExternalEditor } from '../../lib/editors'
import { Dispatcher } from '../dispatcher'
import { TabBar } from '../tab-bar'
import { Accounts } from './accounts'
import { Advanced } from './advanced'
import { Git } from './git'
import { assertNever } from '../../lib/fatal-error'
import { Dialog, DialogFooter, DialogError } from '../dialog'
import {
  getGlobalConfigValue,
  setGlobalConfigValue,
  getMergeTool,
  IMergeTool,
} from '../../lib/git/config'
import { lookupPreferredEmail } from '../../lib/email'
import { Shell, getAvailableShells } from '../../lib/shells'
import { getAvailableEditors } from '../../lib/editors/lookup'
import { gitAuthorNameIsValid } from './identifier-rules'
import { Appearance } from './appearance'
import { ApplicationTheme } from '../lib/application-theme'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Integrations } from './integrations'
import {
  UncommittedChangesStrategyKind,
  uncommittedChangesStrategyKindDefault,
} from '../../models/uncommitted-changes-strategy'

interface IPreferencesProps {
  readonly dispatcher: Dispatcher
  readonly dotComAccount: Account | null
  readonly enterpriseAccount: Account | null
  readonly onDismissed: () => void
  readonly optOutOfUsageTracking: boolean
  readonly initialSelectedTab?: PreferencesTab
  readonly confirmRepositoryRemoval: boolean
  readonly confirmDiscardChanges: boolean
  readonly confirmForcePush: boolean
  readonly uncommittedChangesStrategyKind: UncommittedChangesStrategyKind
  readonly selectedExternalEditor: ExternalEditor | null
  readonly selectedShell: Shell
  readonly selectedTheme: ApplicationTheme
  readonly automaticallySwitchTheme: boolean
}

interface IPreferencesState {
  readonly selectedIndex: PreferencesTab
  readonly committerName: string
  readonly committerEmail: string
  readonly disallowedCharactersMessage: string | null
  readonly optOutOfUsageTracking: boolean
  readonly confirmRepositoryRemoval: boolean
  readonly confirmDiscardChanges: boolean
  readonly confirmForcePush: boolean
  readonly automaticallySwitchTheme: boolean
  readonly uncommittedChangesStrategyKind: UncommittedChangesStrategyKind
  readonly availableEditors: ReadonlyArray<ExternalEditor>
  readonly selectedExternalEditor: ExternalEditor | null
  readonly availableShells: ReadonlyArray<Shell>
  readonly selectedShell: Shell
  readonly mergeTool: IMergeTool | null
}

/** The app-level preferences component. */
export class Preferences extends React.Component<
  IPreferencesProps,
  IPreferencesState
> {
  public constructor(props: IPreferencesProps) {
    super(props)

    this.state = {
      selectedIndex: this.props.initialSelectedTab || PreferencesTab.Accounts,
      committerName: '',
      committerEmail: '',
      disallowedCharactersMessage: null,
      availableEditors: [],
      optOutOfUsageTracking: false,
      confirmRepositoryRemoval: false,
      confirmDiscardChanges: false,
      confirmForcePush: false,
      uncommittedChangesStrategyKind: uncommittedChangesStrategyKindDefault,
      automaticallySwitchTheme: false,
      selectedExternalEditor: this.props.selectedExternalEditor,
      availableShells: [],
      selectedShell: this.props.selectedShell,
      mergeTool: null,
    }
  }

  public async componentWillMount() {
    let committerName = await getGlobalConfigValue('user.name')
    let committerEmail = await getGlobalConfigValue('user.email')

    if (!committerName || !committerEmail) {
      const account = this.props.dotComAccount || this.props.enterpriseAccount

      if (account) {
        if (!committerName) {
          committerName = account.login
        }

        if (!committerEmail) {
          const found = lookupPreferredEmail(account)
          if (found) {
            committerEmail = found.email
          }
        }
      }
    }

    committerName = committerName || ''
    committerEmail = committerEmail || ''

    const [editors, shells, mergeTool] = await Promise.all([
      getAvailableEditors(),
      getAvailableShells(),
      getMergeTool(),
    ])

    const availableEditors = editors.map(e => e.editor)
    const availableShells = shells.map(e => e.shell)

    this.setState({
      committerName,
      committerEmail,
      optOutOfUsageTracking: this.props.optOutOfUsageTracking,
      confirmRepositoryRemoval: this.props.confirmRepositoryRemoval,
      confirmDiscardChanges: this.props.confirmDiscardChanges,
      confirmForcePush: this.props.confirmForcePush,
      uncommittedChangesStrategyKind: this.props.uncommittedChangesStrategyKind,
      availableShells,
      availableEditors,
      mergeTool,
    })
  }

  public render() {
    return (
      <Dialog
        id="preferences"
        title={__DARWIN__ ? 'Preferences' : 'Options'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSave}
      >
        {this.renderDisallowedCharactersError()}
        <TabBar
          onTabClicked={this.onTabClicked}
          selectedIndex={this.state.selectedIndex}
        >
          <span>Accounts</span>
          <span>Integrations</span>
          <span>Git</span>
          <span>Appearance</span>
          <span>Advanced</span>
        </TabBar>

        {this.renderActiveTab()}
        {this.renderFooter()}
      </Dialog>
    )
  }

  private onDotComSignIn = () => {
    this.props.onDismissed()
    this.props.dispatcher.showDotComSignInDialog()
  }

  private onEnterpriseSignIn = () => {
    this.props.onDismissed()
    this.props.dispatcher.showEnterpriseSignInDialog()
  }

  private onLogout = (account: Account) => {
    this.props.dispatcher.removeAccount(account)
  }

  private renderDisallowedCharactersError() {
    const message = this.state.disallowedCharactersMessage
    if (message != null) {
      return <DialogError>{message}</DialogError>
    } else {
      return null
    }
  }

  private renderActiveTab() {
    const index = this.state.selectedIndex
    switch (index) {
      case PreferencesTab.Accounts:
        return (
          <Accounts
            dotComAccount={this.props.dotComAccount}
            enterpriseAccount={this.props.enterpriseAccount}
            onDotComSignIn={this.onDotComSignIn}
            onEnterpriseSignIn={this.onEnterpriseSignIn}
            onLogout={this.onLogout}
          />
        )
      case PreferencesTab.Integrations: {
        return (
          <Integrations
            availableEditors={this.state.availableEditors}
            selectedExternalEditor={this.state.selectedExternalEditor}
            onSelectedEditorChanged={this.onSelectedEditorChanged}
            availableShells={this.state.availableShells}
            selectedShell={this.state.selectedShell}
            onSelectedShellChanged={this.onSelectedShellChanged}
            mergeTool={this.state.mergeTool}
            onMergeToolCommandChanged={this.onMergeToolCommandChanged}
            onMergeToolNameChanged={this.onMergeToolNameChanged}
          />
        )
      }
      case PreferencesTab.Git: {
        return (
          <Git
            name={this.state.committerName}
            email={this.state.committerEmail}
            onNameChanged={this.onCommitterNameChanged}
            onEmailChanged={this.onCommitterEmailChanged}
          />
        )
      }
      case PreferencesTab.Appearance:
        return (
          <Appearance
            selectedTheme={this.props.selectedTheme}
            onSelectedThemeChanged={this.onSelectedThemeChanged}
            automaticallySwitchTheme={this.props.automaticallySwitchTheme}
            onAutomaticallySwitchThemeChanged={
              this.onAutomaticallySwitchThemeChanged
            }
          />
        )
      case PreferencesTab.Advanced: {
        return (
          <Advanced
            optOutOfUsageTracking={this.state.optOutOfUsageTracking}
            confirmRepositoryRemoval={this.state.confirmRepositoryRemoval}
            confirmDiscardChanges={this.state.confirmDiscardChanges}
            confirmForcePush={this.state.confirmForcePush}
            uncommittedChangesStrategyKind={
              this.state.uncommittedChangesStrategyKind
            }
            onOptOutofReportingchanged={this.onOptOutofReportingChanged}
            onConfirmRepositoryRemovalChanged={
              this.onConfirmRepositoryRemovalChanged
            }
            onConfirmDiscardChangesChanged={this.onConfirmDiscardChangesChanged}
            onConfirmForcePushChanged={this.onConfirmForcePushChanged}
            onUncommittedChangesStrategyKindChanged={
              this.onUncommittedChangesStrategyKindChanged
            }
          />
        )
      }
      default:
        return assertNever(index, `Unknown tab index: ${index}`)
    }
  }

  private onOptOutofReportingChanged = (value: boolean) => {
    this.setState({ optOutOfUsageTracking: value })
  }

  private onConfirmRepositoryRemovalChanged = (value: boolean) => {
    this.setState({ confirmRepositoryRemoval: value })
  }

  private onConfirmDiscardChangesChanged = (value: boolean) => {
    this.setState({ confirmDiscardChanges: value })
  }

  private onConfirmForcePushChanged = (value: boolean) => {
    this.setState({ confirmForcePush: value })
  }

  private onUncommittedChangesStrategyKindChanged = (
    value: UncommittedChangesStrategyKind
  ) => {
    this.setState({ uncommittedChangesStrategyKind: value })
  }

  private onCommitterNameChanged = (committerName: string) => {
    this.setState({
      committerName,
      disallowedCharactersMessage: gitAuthorNameIsValid(committerName)
        ? null
        : 'Name is invalid, it consists only of disallowed characters.',
    })
  }

  private onCommitterEmailChanged = (committerEmail: string) => {
    this.setState({ committerEmail })
  }

  private onSelectedEditorChanged = (editor: ExternalEditor) => {
    this.setState({ selectedExternalEditor: editor })
  }

  private onSelectedShellChanged = (shell: Shell) => {
    this.setState({ selectedShell: shell })
  }

  private onSelectedThemeChanged = (theme: ApplicationTheme) => {
    this.props.dispatcher.setSelectedTheme(theme)
  }

  private onAutomaticallySwitchThemeChanged = (
    automaticallySwitchTheme: boolean
  ) => {
    this.props.dispatcher.onAutomaticallySwitchThemeChanged(
      automaticallySwitchTheme
    )
  }

  private renderFooter() {
    const hasDisabledError = this.state.disallowedCharactersMessage != null

    const index = this.state.selectedIndex
    switch (index) {
      case PreferencesTab.Accounts:
      case PreferencesTab.Appearance:
        return null
      case PreferencesTab.Integrations:
      case PreferencesTab.Advanced:
      case PreferencesTab.Git: {
        return (
          <DialogFooter>
            <OkCancelButtonGroup
              okButtonText="Save"
              okButtonDisabled={hasDisabledError}
            />
          </DialogFooter>
        )
      }
      default:
        return assertNever(index, `Unknown tab index: ${index}`)
    }
  }

  private onSave = async () => {
    await setGlobalConfigValue('user.name', this.state.committerName)
    await setGlobalConfigValue('user.email', this.state.committerEmail)
    await this.props.dispatcher.setStatsOptOut(
      this.state.optOutOfUsageTracking,
      false
    )
    await this.props.dispatcher.setConfirmRepoRemovalSetting(
      this.state.confirmRepositoryRemoval
    )

    await this.props.dispatcher.setConfirmForcePushSetting(
      this.state.confirmForcePush
    )

    if (this.state.selectedExternalEditor) {
      await this.props.dispatcher.setExternalEditor(
        this.state.selectedExternalEditor
      )
    }
    await this.props.dispatcher.setShell(this.state.selectedShell)
    await this.props.dispatcher.setConfirmDiscardChangesSetting(
      this.state.confirmDiscardChanges
    )

    await this.props.dispatcher.setUncommittedChangesStrategyKindSetting(
      this.state.uncommittedChangesStrategyKind
    )

    const mergeTool = this.state.mergeTool
    if (mergeTool && mergeTool.name) {
      await setGlobalConfigValue('merge.tool', mergeTool.name)

      if (mergeTool.command) {
        await setGlobalConfigValue(
          `mergetool.${mergeTool.name}.cmd`,
          mergeTool.command
        )
      }
    }

    this.props.onDismissed()
  }

  private onTabClicked = (index: number) => {
    this.setState({ selectedIndex: index })
  }

  private onMergeToolNameChanged = (name: string) => {
    const mergeTool = {
      name,
      command: this.state.mergeTool && this.state.mergeTool.command,
    }
    this.setState({ mergeTool })
  }

  private onMergeToolCommandChanged = (command: string) => {
    const mergeTool = {
      name: this.state.mergeTool ? this.state.mergeTool.name : '',
      command,
    }
    this.setState({ mergeTool })
  }
}
