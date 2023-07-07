// Copyright (C) 2023 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file should not import anything else. Since the settings will be used
// from ~everywhere and the are "statically" initialized (i.e. files
// construct Settings at import time) if this file starts importing
// anything we will quickly run into issues with initialization order
// which will be a pain.

export interface Setting<T> {
//  // A unique identifier for this setting:
//  // "dev.perfetto.magicSorting"
//  readonly id: string;
//
//  // The name of the setting the user sees:
//  // "New track sorting algorithm"
//  readonly name: string;
//
//  // A longer description which is displayed to the user:
//  // "Sort tracks using an embedded tfLite model based on your expression"
//  readonly description: string;
//
//  // The setting's default value.
//  // If !setting.isOverridden() then setting.get() === setting.defaultValue
//  readonly defaultValue: T;

  // Get the current value of the setting.
  get(): T;

//  // Override the setting and persist the new value.
//  set(value: T): void;
//
//  // If the setting has been overridden.
//  // Note: A setting can be overridden to its default value.
//  isOverridden(): boolean;
//
//  // Reset the setting to its default value.
//  reset(): void;
//
//  // Get the current state of the setting.
//  overriddenState(): OverrideState;
}

interface SettingArgs<T> {
  id: string;
  defaultValue: T;
  description: string;
  name?: string;
  devOnly?: boolean;
}

class Settings {
  private storage: SettingsStorage;

  constructor(storage: SettingsStorage) {
    this.storage = storage;
    console.log(this.storage);
    //this.load();
  }

  register<T>(args: SettingArgs<T>): Setting<T> {
    return new SettingImpl<T>(this, args);
  }
}

class SettingImpl<T> implements Setting<T> {
  registry: Settings;
  defaultValue: T;

  constructor(registry: Settings, args: SettingArgs<T>) {
    this.registry = registry;
    this.defaultValue = args.defaultValue;
  }

  get(): T {
    return defaultValue;
  }
}

interface SettingsStorage {
  save(data: unknown): void;
  load(): unknown;
}

class LocalSettingsStorage implements SettingsStorage {
  save(data: unknown): void {
  }

  load(): unknown {
    return null;
  }
}

export const SettingsForTesting = Settings;
export const settings = new Settings(new LocalSettingsStorage());

