# WebRadio Architecture Guide

**Version:** 2.0
**Applies to:** WebRadio v1.0.5+

---

# Introduction

Welcome to the WebRadio Architecture Guide.

This document explains how WebRadio is built internally and why the project is structured the way it is. It is intended for contributors, plugin developers and anyone interested in understanding the application's architecture.

Unlike traditional documentation that only explains *how* something works, this guide also explains *why* architectural decisions were made.

The goal of WebRadio is not only to provide a modern desktop radio application, but also a clean, modular and maintainable platform that can be extended without modifying the core application.

Every major subsystem has a clearly defined responsibility. This separation allows new functionality to be added while keeping the core stable, understandable and easy to maintain.

The architecture follows a few simple principles:

* Every component has a single responsibility.
* Components communicate through well-defined interfaces.
* Features should be replaceable without affecting unrelated systems.
* Plugins and themes should extend the application instead of modifying it.
* The application startup should be predictable and centralized.

These principles have guided the evolution of WebRadio and continue to shape its future development.

This guide provides an overview of the complete application architecture before diving into the individual systems such as the Plugin Manager, Theme Manager, Diagnostics, Storage, IPC and Renderer.
