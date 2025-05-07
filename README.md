# Voxidian architecture

_Automatically synced with your [v0.dev](https://v0.dev) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/ranmag/v0-voxidian-architecture)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/zlVTEE5K1bj)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/ranmag/v0-voxidian-architecture](https://vercel.com/ranmag/v0-voxidian-architecture)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/zlVTEE5K1bj](https://v0.dev/chat/projects/zlVTEE5K1bj)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Architecture

This is a simple single page app with 5 states:

1. Not recording: We see a record button.
2. Recording: We see a timer and a send button
3. Paused: We see the timer paused, a send button, a trash button and a play button.
4. Sending: We see a progress bar.
5. Failed: We see a send button, a trash button and a play button.

The app states transition is as follows:

- Not recording -> Recording (record)
- Recording -> Paused (pause)
- Recording -> Sending (send)
- Paused -> Recording (record is resumed)
- Paused -> Sending (send)
- Paused -> Not recording (trash)
- Sending -> Failed (if there is an error in sending)
- Sending -> Not recording (success)
- Failed -> Not recording (trash)
