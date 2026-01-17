# Rabbit - Discord Ticket & Application Bot

A multi-server Discord bot with a premium ticket system and application system.

## Features

### Ticket System
- Customizable ticket panels with embed + buttons
- Multiple panel types per server (support, billing, etc.)
- Claim system for staff
- Priority levels (low, normal, high, urgent)
- HTML transcript generation
- Auto-close inactive tickets
- Ticket limits per user
- User blacklist
- Detailed logging
- Feedback/rating system

### Application System
- Custom application types (staff, moderator, etc.)
- Up to 5 questions per application
- Modal-based form submission
- Auto-creates ticket on submission
- Accept/deny workflow with DM notifications
- Application cooldowns

## Setup

1. **Install dependencies**
   ```bash
   cd rabbit-bot
   npm install
   ```

2. **Configure environment**

   Edit `.env` file:
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ```

3. **Start the bot**
   ```bash
   npm start
   ```

## Commands

### Ticket Commands
- `/panel` - Create a ticket panel
- `/close [reason]` - Close a ticket
- `/claim` - Claim a ticket
- `/add @user` - Add user to ticket
- `/remove @user` - Remove user from ticket
- `/rename <name>` - Rename ticket channel
- `/priority <level>` - Set ticket priority
- `/transcript` - Generate transcript
- `/ticketsettings` - Configure ticket settings

### Application Commands
- `/appsetup` - Create application type
- `/appquestions add/remove/list` - Manage questions
- `/appsettings list/view/panel/toggle/delete` - Manage applications

## Required Bot Permissions
- Manage Channels
- Manage Roles
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Use External Emojis
- Add Reactions
- Manage Messages

## Required Intents
- Guilds
- GuildMessages
- MessageContent
- GuildMembers

## Quick Start Guide

### Setting up Tickets
1. Set support roles: `/ticketsettings addrole @SupportRole`
2. Set log channel: `/ticketsettings logs #ticket-logs`
3. Set transcript channel: `/ticketsettings transcripts #transcripts`
4. Set ticket category: `/ticketsettings category #Tickets`
5. Create a panel: `/panel type:support title:"Support" description:"Click below for help"`

### Setting up Applications
1. Create application: `/appsetup name:"Staff Application" description:"Apply to join our team"`
2. Add questions: `/appquestions add application:"Staff Application" question:"Why do you want to join?" type:Paragraph`
3. Add review role: `/appsettings addrole application:"Staff Application" role:@Admin`
4. Deploy panel: `/appsettings panel application:"Staff Application"`
