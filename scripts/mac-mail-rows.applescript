tell application "Mail"
  check for new mail
  repeat with accountItem in accounts
    if (email addresses of accountItem) contains "taitatu4alexandros@gmail.com" then
      set inboxItem to mailbox "INBOX" of accountItem
      set recentMessages to (messages of inboxItem whose date received > ((current date) - 2 * days))
      set outputLines to {}
      repeat with messageItem in recentMessages
        set end of outputLines to ((id of messageItem) as text) & (ASCII character 31) & ((sender of messageItem) as text) & (ASCII character 31) & ((subject of messageItem) as text) & (ASCII character 31) & ((date received of messageItem) as text) & (ASCII character 31) & ((read status of messageItem) as text)
      end repeat
      set AppleScript's text item delimiters to (ASCII character 30)
      return outputLines as text
    end if
  end repeat
end tell
error "Mail account missing"
