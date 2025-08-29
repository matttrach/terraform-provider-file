# Changelog

## [0.1.4](https://github.com/matttrach/terraform-provider-file/compare/v0.1.3...v0.1.4) (2025-08-29)


### Bug Fixes

* add manual backport workflow ([#128](https://github.com/matttrach/terraform-provider-file/issues/128)) ([#131](https://github.com/matttrach/terraform-provider-file/issues/131)) ([7300e97](https://github.com/matttrach/terraform-provider-file/commit/7300e97fd2f0b0153aad619ed29d459030938bb6))
* bump github.com/ulikunitz/xz from 0.5.10 to 0.5.14 in /test ([#126](https://github.com/matttrach/terraform-provider-file/issues/126)) ([#136](https://github.com/matttrach/terraform-provider-file/issues/136)) ([a1e577a](https://github.com/matttrach/terraform-provider-file/commit/a1e577a99c9c8de7269230491846bd2a1534d4b0))
* hard code the owner and repo name ([#132](https://github.com/matttrach/terraform-provider-file/issues/132)) ([#138](https://github.com/matttrach/terraform-provider-file/issues/138)) ([044075c](https://github.com/matttrach/terraform-provider-file/commit/044075c7d1c818b8d878e54048bc88958e700e35))

## [0.1.3](https://github.com/rancher/terraform-provider-file/compare/v0.1.2...v0.1.3) (2025-08-28)


### Bug Fixes

* correct the rc calculation ([#121](https://github.com/rancher/terraform-provider-file/issues/121)) ([#124](https://github.com/rancher/terraform-provider-file/issues/124)) ([8d7fae6](https://github.com/rancher/terraform-provider-file/commit/8d7fae6cddd41a742fb50fca4cb4ffa9f5d2529b))

## [0.1.2](https://github.com/rancher/terraform-provider-file/compare/v0.1.1...v0.1.2) (2025-08-28)


### Bug Fixes

* add a new workflow for release candidates ([#93](https://github.com/rancher/terraform-provider-file/issues/93)) ([#96](https://github.com/rancher/terraform-provider-file/issues/96)) ([fe4bdc6](https://github.com/rancher/terraform-provider-file/commit/fe4bdc6dce3069c1a65098cc4e78732dcadf544f))
* add checkout action before release please ([#101](https://github.com/rancher/terraform-provider-file/issues/101)) ([#104](https://github.com/rancher/terraform-provider-file/issues/104)) ([376aab0](https://github.com/rancher/terraform-provider-file/commit/376aab0bb2988af94db8d894379fdbdee364f2c7))
* backport PR need individual assignees ([#88](https://github.com/rancher/terraform-provider-file/issues/88)) ([#91](https://github.com/rancher/terraform-provider-file/issues/91)) ([911c134](https://github.com/rancher/terraform-provider-file/commit/911c134974b725231b17e1372f4de76b9a414ea5))
* get version properly ([#109](https://github.com/rancher/terraform-provider-file/issues/109)) ([#112](https://github.com/rancher/terraform-provider-file/issues/112)) ([70b7da9](https://github.com/rancher/terraform-provider-file/commit/70b7da9780764fe35c1c6b22001eff1751f185f0))
* manually generate release candidate tag ([#105](https://github.com/rancher/terraform-provider-file/issues/105)) ([#108](https://github.com/rancher/terraform-provider-file/issues/108)) ([3ec02c3](https://github.com/rancher/terraform-provider-file/commit/3ec02c34195e19620e0dea66e69aa0990aafa328))
* resolve client and protection flaws ([#113](https://github.com/rancher/terraform-provider-file/issues/113)) ([#116](https://github.com/rancher/terraform-provider-file/issues/116)) ([0291bc4](https://github.com/rancher/terraform-provider-file/commit/0291bc4c6bb0592e98393d8bf9617935ad568891))
* tell release please not to skip the release ([#97](https://github.com/rancher/terraform-provider-file/issues/97)) ([#100](https://github.com/rancher/terraform-provider-file/issues/100)) ([e9320a4](https://github.com/rancher/terraform-provider-file/commit/e9320a4ddbed9fcabff7ea62cd2820f623408049))
* typo in backport pr script ([#117](https://github.com/rancher/terraform-provider-file/issues/117)) ([#120](https://github.com/rancher/terraform-provider-file/issues/120)) ([41f239a](https://github.com/rancher/terraform-provider-file/commit/41f239af5a4253d3ea211477552d6ceb3842b4ca))

## [0.1.1](https://github.com/rancher/terraform-provider-file/compare/v0.1.0...v0.1.1) (2025-08-26)


### Bug Fixes

* add write access to the actions permission ([#63](https://github.com/rancher/terraform-provider-file/issues/63)) ([#67](https://github.com/rancher/terraform-provider-file/issues/67)) ([b807212](https://github.com/rancher/terraform-provider-file/commit/b8072121885404e163b5b050ebb050ae67748b44))
* bump action dependencies ([0533008](https://github.com/rancher/terraform-provider-file/commit/0533008f61d18a96f9107221c4df260280919a70))
* general workflow improvements ([#80](https://github.com/rancher/terraform-provider-file/issues/80)) ([#83](https://github.com/rancher/terraform-provider-file/issues/83)) ([e8ac3cb](https://github.com/rancher/terraform-provider-file/commit/e8ac3cb57afa769c26050e6b259140a5a0ac90d6))
* improve release please configuration ([#84](https://github.com/rancher/terraform-provider-file/issues/84)) ([#87](https://github.com/rancher/terraform-provider-file/issues/87)) ([e577d80](https://github.com/rancher/terraform-provider-file/commit/e577d807228a4e1a07281a7c2d2ebc213e8f3ffd))
* only pull credentials after the release ([#68](https://github.com/rancher/terraform-provider-file/issues/68)) ([#73](https://github.com/rancher/terraform-provider-file/issues/73)) ([598d58c](https://github.com/rancher/terraform-provider-file/commit/598d58cbc456aa724cb1ba52ed2b96ec83b8872a))
* set specific permissions on release workflow ([#55](https://github.com/rancher/terraform-provider-file/issues/55)) ([#58](https://github.com/rancher/terraform-provider-file/issues/58)) ([f9bd0ad](https://github.com/rancher/terraform-provider-file/commit/f9bd0adf9f45308b9e9a59fccc468b011baa013b))
* try setting permissions at job level ([#59](https://github.com/rancher/terraform-provider-file/issues/59)) ([#66](https://github.com/rancher/terraform-provider-file/issues/66)) ([86a8686](https://github.com/rancher/terraform-provider-file/commit/86a868604604acfdef1dc3062a4afdcd54c48bb8))
* Use more advanced release configuration ([#75](https://github.com/rancher/terraform-provider-file/issues/75)) ([#78](https://github.com/rancher/terraform-provider-file/issues/78)) ([eeff283](https://github.com/rancher/terraform-provider-file/commit/eeff28386f5bf4d51772381a69981bc765c03d02))
