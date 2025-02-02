# WebDAV Service for TDrive

This document provides an overview of the WebDAV service implementation for Twake Drive, which allows users to access and manipulate their files using the WebDAV protocol.

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
3. [Setup and Configuration](#setup-and-configuration)
4. [Usage](#usage)
5. [Authentication](#authentication)
6. [Limitations and Considerations](#limitations-and-considerations)

## Overview

The WebDAV service is implemented using the Nephele library and integrates with Twake Drive's existing file storage and permission system. It provides standard WebDAV functionality, including file operations (read, write, delete), directory listings, and locking mechanisms.

## Components

The WebDAV service consists of several key components:

1. [Adapter](Adapter.md): Interfaces between Nephele and Twake Drive's file system.
2. [ResourceService](ResourceService.md): Implements the Resource interface, handling file and directory operations.
3. [PropertiesService](PropertiesService.md): Manages WebDAV properties for resources.
4. [DriveLock](DriveLock.md): Implements locking mechanisms for WebDAV resources.

## Setup and Configuration

To set up the WebDAV service:

1. Ensure all dependencies are installed.
2. Configure the `routes.ts` file to set up the WebDAV endpoint (default: `internal/services/webdav/v1/webdav`).

## Usage

Once set up, users can connect to the WebDAV service using any WebDAV-compatible client. The service supports standard WebDAV operations such as:

- Browsing directories
- Uploading and downloading files
- Creating and deleting directories
- Moving and copying files/directories
- Setting and retrieving file properties
- Locking and unlocking resources

## Authentication

The service uses Basic Authentication. Users need to provide their device ID as the username and device password as the password.

Example:
```
Authorization: Basic base64(device_id:device_password)
```

## Limitations and Considerations

- Locks are stored within the DriveFile object to maintain database compatibility.
- Performance may vary depending on the size and number of files being accessed.

For more detailed information on each component, please refer to their respective documentation files.