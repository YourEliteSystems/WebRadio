# Notifications

The `Notifications` service provides a unified way for plugins to display notifications to the user.

Notifications are intended to communicate important information, warnings, errors and successful operations without interrupting the user workflow.

Plugins should use the Notifications service instead of implementing their own notification system.

---

# Responsibilities

The Notifications service is responsible for:

* Displaying informational messages
* Displaying success messages
* Displaying warnings
* Displaying errors
* Providing a consistent notification experience
* Managing notification lifetime

Notifications should remain informative and unobtrusive.

---

# Accessing Notifications

The Notifications service is available through the `PluginContext`.

Example:

```javascript id="n4ph8x"
const notifications = context.notifications;
```

Plugins should never instantiate the Notifications service directly.

---

# Notification Types

The Notifications service supports multiple notification types.

```text id="6e7mzq"
Info

Success

Warning

Error
```

Each type communicates a different level of importance.

---

# Methods

## info()

Displays an informational notification.

### Syntax

```javascript id="8qy3vk"
notifications.info(

    "Station added successfully."

);
```

Use informational notifications for normal application events.

---

## success()

Displays a success notification.

### Syntax

```javascript id="pr0k9v"
notifications.success(

    "Playlist imported."

);
```

Success notifications confirm completed operations.

---

## warn()

Displays a warning notification.

### Syntax

```javascript id="i7mh2a"
notifications.warn(

    "Station metadata is incomplete."

);
```

Warnings inform the user about recoverable situations.

---

## error()

Displays an error notification.

### Syntax

```javascript id="k2v7fy"
notifications.error(

    "Unable to connect to the radio station."

);
```

Errors should describe what went wrong and, where possible, help the user understand the problem.

---

# Notification Lifetime

Notifications remain visible for a limited period.

```text id="m5v4kz"
Show Notification

↓

Visible

↓

Automatic Timeout

↓

Hidden
```

Critical notifications may require explicit dismissal depending on the implementation.

---

# Notification Content

Notifications should be:

* Short
* Clear
* Actionable
* Easy to understand

Good example:

```text id="b6nr4d"
Station saved successfully.
```

Poor example:

```text id="0cpvjr"
Something happened.
```

---

# Error Notifications

Error notifications should never expose sensitive information.

Recommended:

```javascript id="xy4bm1"
notifications.error(

    "Unable to save your settings."

);
```

Avoid displaying stack traces or internal implementation details.

---

# Best Practices

✔ Keep messages concise.

✔ Use the correct notification type.

✔ Inform users only when necessary.

✔ Write human-readable messages.

✔ Avoid repeated notifications for the same event.

✔ Log technical details separately using the Logger.

---

# Common Mistakes

Typical mistakes include:

* Displaying excessive notifications.
* Using error notifications for normal behaviour.
* Showing technical exceptions to users.
* Displaying duplicate notifications.
* Writing vague messages.

Notifications should improve the user experience rather than distract from it.

---

# Related APIs

The Notifications service commonly works together with:

* PluginContext
* Logger
* Commands
* Events

Notifications provide user feedback, while the Logger records technical information.

---

# Example

```javascript id="q8yd5m"
try {

    await savePlaylist();

    context.notifications.success(

        "Playlist saved successfully."

    );

}

catch (error) {

    context.logger.error(error);

    context.notifications.error(

        "Failed to save playlist."

    );

}
```

---

# See Also

* PluginContext
* Logger
* Commands
* Events
* Application
